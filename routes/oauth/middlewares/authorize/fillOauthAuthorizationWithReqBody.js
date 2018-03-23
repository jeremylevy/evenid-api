var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var validator = require('validator');

var moment = require('moment');

var config = require('../../../../config');

var db = require('../../../../models');

var addUserEmail = require('../../../users/middlewares/addUserEmail');
var addUserPhoneNumber = require('../../../users/middlewares/addUserPhoneNumber');
var addUserAddress = require('../../../users/middlewares/addUserAddress');

var removeEmails = require('../../../../models/actions/removeEmails');
var removePhoneNumbers = require('../../../../models/actions/removePhoneNumbers');
var removeAddress = require('../../../../models/actions/removeAddress');

var updateUserPhoneNumber = require('../../../users/middlewares/updateUserPhoneNumber');

var InvalidRequestError = require('../../../../errors/types/InvalidRequestError');
var ServerError = require('../../../../errors/types/ServerError');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var isValidationError = require('../../../../models/validators/isValidationError');
var isUniqueIndexError = require('../../../../models/validators/isUniqueIndexError');

module.exports = function (req, res, next) {
    var useTestAccount = res.locals.useTestAccount;
    
    var client = res.locals.client;
    var user = res.locals.user;

    var fieldsToShow = res.locals.fieldsToShow;
    var fieldsToAuthorize = res.locals.fieldsToAuthorize;

    var oauthAuthorization = res.locals.oauthAuthorization;
    var authorizedEntities = res.locals.authorizedEntities;

    if (req.method !== 'POST') {
        throw new Error('`fillOauthAuthorizationWithReqBody` middleware must be used '
                        + 'during `POST` requests');
    }
    
    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `fillOauthAuthorizationWithReqBody` '
                        + 'middleware');
    }

    if (useTestAccount) {
        return next();
    }

    if (!client) {
        throw new Error('`client` must be set as response locals ' 
                        + 'property before calling `fillOauthAuthorizationWithReqBody` ' 
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `fillOauthAuthorizationWithReqBody` '
                        + 'middleware');
    }

    if (!fieldsToShow) {
        throw new Error('`fieldsToShow` must be set as response locals '
                        + 'property before calling `fillOauthAuthorizationWithReqBody` '
                        + 'middleware');
    }

    if (!fieldsToAuthorize) {
        throw new Error('`fieldsToAuthorize` must be set as response locals '
                        + 'property before calling `fillOauthAuthorizationWithReqBody` '
                        + 'middleware');
    }

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `fillOauthAuthorizationWithReqBody` '
                        + 'middleware');
    }

    if (!authorizedEntities) {
        throw new Error('`authorizedEntities` must be set as response locals '
                        + 'property before calling `fillOauthAuthorizationWithReqBody` '
                        + 'middleware');
    }

    var userNeedsToBeUpdated = false;

    var authorizedEntitiesKey = null;

    var expectedFields = fieldsToShow.concat(Object.keys(fieldsToAuthorize));
    var expectedField = null;

    // User may have many emails, phone numbers and addresses
    var multipleFields = ['email', 'address', 
                          'billing_address', 'shipping_address', 
                          'phone_number', 'mobile_phone_number', 
                          'landline_phone_number'];

    var serverErrors = [];
    var invalidRequestErrors = {};
    var addInvalidRequestErrors = function (errors) {
        Object.keys(errors).forEach(function (error) {
            invalidRequestErrors[error] = errors[error];
        });
    };
    var validationErrors = {};
    var addValidationError = function (kind, path, message, prefix) {
        validationErrors[path] = {
            kind: kind,
            message: message,
            path: path,
            prefix: prefix
        };
    };
    var addUniqueIndexError = function (uniqueIndexError) {
        validationErrors[uniqueIndexError.message] = uniqueIndexError;
    };
    var addValidationErrorsWithPrefix = function (errors, prefix) {
        for (var error in errors) {
            addValidationError(errors[error].kind, 
                               prefix + errors[error].path, 
                               errors[error].message,
                               prefix);
        }
    };

    var addressObjForOauthAuth = {};
    var fieldIsAnAddress = function (field) {
        return ['address', 'shipping_address', 'billing_address'].indexOf(field) !== -1;
    };
    var addressFieldIsFor = function (field) {
        // 'shipping_address' or 'billing_address'
        // -> 'shipping' or 'billing'
        var addressFor = field.split('_')[0];

        assert.ok(config.EVENID_ADDRESSES.FOR.indexOf(addressFor) !== -1);

        return addressFor;
    };

    var fieldIsAPhoneNumber = function (field) {
        return ['phone_number', 
                'mobile_phone_number', 
                'landline_phone_number'].indexOf(field) !== -1;
    };
    var phoneNumberFieldIsFor = function (field) {
        if (['mobile_phone_number', 'landline_phone_number'].indexOf(field) !== -1) {
            return field.split('_')[0];
        }

        return undefined;
    };

    var getOauthAuthUserEntityNameForField = function (field) {
        if (fieldIsAnAddress(field)) {
            return 'addresses';
        }

        if (fieldIsAPhoneNumber(field)) {
            return 'phone_numbers';
        }

        if (field === 'email') {
            return 'emails';
        }
    };

    // Remove prefix when calling middleware
    // to add multiple entity of the same type
    // like shipping address and billing address
    var getReqBodyFieldsWithoutPrefix = function (prefix, reqBody) {
        var body = {};
        var prefixReg = new RegExp('^' + prefix);

        for (var field in reqBody) {
            if (!field.match(prefixReg)) {
                continue;
            }

            body[field.replace(prefixReg, '')] = reqBody[field];
        }

        return body;
    };

    var fnsToCall = [];
    // Used to rollback during error.
    // If an error arise during registration and
    // we don't rollback, form may change and display 
    // `will be authorized to access to...` for the same client.
    var revertFns = [];
    var oldUser = {};
    
    var endCallback = null;
    
    var manageErrInCb = function (err, prefix, cb) {
        if (isValidationError(err)) {
            addValidationErrorsWithPrefix(err.errors, prefix);

            return cb(null);
        }

        if (isUniqueIndexError(err)) {
            addUniqueIndexError(err);

            return cb(null);
        }

        if (err instanceof InvalidRequestError) {
            addInvalidRequestErrors(err.messages);
            addValidationErrorsWithPrefix(err.mongooseValidationErrors, prefix);

            return cb(null);
        }

        serverErrors.push(err);

        cb(null);
    };

    for (var i = 0, j = expectedFields.length; i < j; ++i) {
        expectedField = expectedFields[i];

        fieldValue = validator.trim(req.body[expectedField]);

        // Profil photo is set via Ajax
        // and fallback to gravatar so always set
        if (expectedField === 'profil_photo') {
            continue;
        }

        // Billing address will be added 
        // alongs shipping address if user uses the same address
        if (expectedField === 'billing_address'
            // Checkbox checked
            && (!!req.body.use_as_billing_address
                // Same address used for billing and shipping
                || (areValidObjectIDs([fieldValue]) 
                    && fieldValue === req.body.shipping_address))) {

            continue;
        }

        // Singular attributes (nickname, gender, date of birth...)
        if (multipleFields.indexOf(expectedField) === -1) {
            // Date of birth was displayed with
            // three selects
            if (expectedField === 'date_of_birth') {
                fieldValue = [validator.trim(req.body.date_of_birth_month), 
                              validator.trim(req.body.date_of_birth_day), 
                              validator.trim(req.body.date_of_birth_year)].join('-');
                
                // You may specify a boolean for the last argument 
                // to make Moment use strict parsing
                fieldValue = moment(fieldValue, 'M-D-YYYY', true);

                // Display `must be set` error
                // if date was not valid = a date field was not set
                if (!fieldValue.isValid()) {
                    fieldValue = undefined;
                }
            }

            // Empty field
            if (!fieldValue) {
                addValidationError('required', expectedField);
                continue;
            }

            oldUser[expectedField] = user[expectedField];
            user[expectedField] = fieldValue;

            // Add fn to update user 
            // if not set
            if (!userNeedsToBeUpdated) {
                userNeedsToBeUpdated = true;

                fnsToCall.push(function (cb) {
                    user.save(function (err, user) {
                        if (err) {
                            return manageErrInCb(err, '', cb);
                        }

                        revertFns.push(function (cb) {
                            Object.keys(oldUser).forEach(function (k) {
                                user[k] = oldUser[k];
                            });

                            user.save(function (err, updatedUser) {
                                cb(null);
                            });
                        });

                        cb(null, user);
                    });
                });
            }

            continue;
        } else { // Plural attributes (emails, phone numbers...)

            // Authorize access
            if (areValidObjectIDs([fieldValue])
                // Check that user own ref
                && user.own(getOauthAuthUserEntityNameForField(expectedField), fieldValue)) {

                if (fieldIsAPhoneNumber(expectedField)) {
                    // User has chosen phone number for mobile or landline phone type
                    // Update phone number's phone type accordingly
                    if (phoneNumberFieldIsFor(expectedField)) {

                        // Keep ref to `expectedField`
                        // and `fieldValue`
                        (function (expectedField, fieldValue) {
                            fnsToCall.push(function (cb) {
                                updateUserPhoneNumber.call({
                                    name: 'oauthAuthorize',
                                    phoneNumberID: fieldValue,
                                    body: {
                                        phone_type: phoneNumberFieldIsFor(expectedField)
                                    }
                                }, req, res, function (err, phoneNumber) {
                                    if (err) {
                                        return manageErrInCb(err, '', cb);
                                    }

                                    cb(null, phoneNumber);
                                });
                            });
                        })(expectedField, fieldValue);
                    }
                }

                // Keep ref if address is for billing or shipping by 
                // attaching it to the oauth authorization
                if (fieldIsAnAddress(expectedField)) { 
                    
                    if (oauthAuthorization.scope_flags
                                          .indexOf('separate_shipping_billing_address') !== -1) {

                        // Add address to oauth authorization
                        addressObjForOauthAuth = {
                            address: fieldValue,
                            'for': [addressFieldIsFor(expectedField)]
                        };

                        // If user uses the same address for billing and shipping
                        if (addressFieldIsFor(expectedField) === 'shipping'
                            // Checkbox checked
                            && (!!req.body.use_as_billing_address
                                // User use same address for billing and shipping address
                                || fieldValue === req.body.billing_address)) {

                            addressObjForOauthAuth['for'] = ['shipping', 'billing'];
                        }

                        oauthAuthorization.user.addresses.push(addressObjForOauthAuth);
                    } else {
                        // User wants this address 
                        // to be selected first in select,
                        // so keep ref of it
                        addressObjForOauthAuth = {
                            address: fieldValue,
                            'for': ['addresses']
                        };

                        oauthAuthorization.user.addresses.push(addressObjForOauthAuth);
                    }
                }

                authorizedEntitiesKey = getOauthAuthUserEntityNameForField(expectedField);

                if (fieldIsAPhoneNumber(expectedField)) {
                    authorizedEntitiesKey = (phoneNumberFieldIsFor(expectedField) || 'unknown') + '_phone_numbers';
                }

                // Add authorized entities to user authorization
                authorizedEntities[authorizedEntitiesKey]
                                  .push(fieldValue);

                continue;
            } // End authorize access

            // Insert new value
            // call middlewares with specified context
            // in order to avoid sending response
            // directly

            if (expectedField === 'email') {

                // Keep ref to expected field
                (function (expectedField) {
                    fnsToCall.push(function (cb) {
                        addUserEmail.call({
                            name: 'oauthAuthorize'
                        }, req, res, function (err, email) {
                            if (err) {
                                return manageErrInCb(err, '', cb);
                            }

                            revertFns.push(function (cb) {
                                removeEmails([email.id], user.id, function (err) {
                                    cb(null);
                                });
                            });

                            // Add email ref to authorized entities
                            authorizedEntities.emails.push(email.id);

                            cb(null, email);
                        });
                    });
                })(expectedField);

                continue;
            }

            if (fieldIsAPhoneNumber(expectedField)) {
                
                // Keep ref to expected field
                (function (expectedField) {
                    fnsToCall.push(function (cb) {
                        // Remove `landline_phone_number_` and `mobile_phone_number_` prefix
                        var body = getReqBodyFieldsWithoutPrefix(expectedField + '_', req.body);
                        var phoneType = phoneNumberFieldIsFor(expectedField);

                        if (phoneType) {
                            body.phone_type = phoneType;
                        }

                        addUserPhoneNumber.call({
                            name: 'oauthAuthorize',
                            // Overwrite req.body
                            body: body
                        }, req, res, function (err, phoneNumber) {
                            var authorizedEntitiesKey = phoneType || 'unknown';

                            if (err) {
                                return manageErrInCb(err, expectedField + '_', cb);
                            }

                            revertFns.push(function (cb) {
                                removePhoneNumbers([phoneNumber.id], user.id, function (err) {
                                    cb(null);
                                });
                            });

                            authorizedEntities[authorizedEntitiesKey + '_phone_numbers'].push(phoneNumber.id);

                            return cb(null, phoneNumber);
                        });
                    });
                })(expectedField);

                continue;
            }

            if (fieldIsAnAddress(expectedField)) {

                // Keep ref to expected field
                (function (expectedField) {
                    fnsToCall.push(function (cb) {
                        // Remove `shipping_address` 
                        // and `billing_address` prefix
                        var reqBody = getReqBodyFieldsWithoutPrefix(expectedField + '_', req.body);

                        addUserAddress.call({
                            name: 'oauthAuthorize',
                            // Overwrite req.body
                            body: reqBody
                        }, req, res, function (err, address) {
                            if (err) {
                                return manageErrInCb(err, expectedField + '_', cb);
                            }

                            revertFns.push(function (cb) {
                                removeAddress(address.id, user.id, function (err) {
                                    cb(null);
                                });
                            });

                            // Keep ref if address is for billing or shipping by 
                            // attaching it to the oauth authorization
                            if (oauthAuthorization.scope_flags
                                                  .indexOf('separate_shipping_billing_address') !== -1) {

                                addressObjForOauthAuth = {
                                    address: address.id,
                                    'for': [addressFieldIsFor(expectedField)]
                                };

                                // Also add as billing address 
                                // if user has checked `use as billing address`
                                if (addressFieldIsFor(expectedField) === 'shipping'
                                    // Checkbox checked
                                    && !!req.body.use_as_billing_address) {

                                    addressObjForOauthAuth['for'] = ['shipping', 'billing'];
                                }
                                
                                oauthAuthorization.user.addresses.push(addressObjForOauthAuth);
                            } else {
                                // User wants this address 
                                // to be selected first in select,
                                // so keep ref of it
                                addressObjForOauthAuth = {
                                    address: address.id,
                                    'for': ['addresses']
                                };

                                oauthAuthorization.user.addresses.push(addressObjForOauthAuth);
                            }

                            // Add address ref to authorized entities
                            authorizedEntities.addresses.push(address.id);

                            cb(null, address);
                        });
                    });
                })(expectedField);

                continue;
            }
        }
    } // End for loop

    endCallback = function () {
        var errCallback = function () {
            if (Object.keys(invalidRequestErrors).length 
                || Object.keys(validationErrors).length) {

                return next(new InvalidRequestError(invalidRequestErrors, validationErrors));
            }

            // Unmanaged errors. The error middleware 
            // will responds with `server_error`
            if (serverErrors.length) {
                return next(new ServerError(serverErrors));
            }
        };

        // A phone number cannot be used as mobile and landline
        // Manage this error at the end of the for loop 
        // in order to merge it with others error.
        if (expectedFields.indexOf('mobile_phone_number') !== -1
            && expectedFields.indexOf('landline_phone_number') !== -1
            // User set the same number in input
            && ((req.body.mobile_phone_number_number
                && req.body.landline_phone_number_number
                && req.body.mobile_phone_number_number === req.body.landline_phone_number_number)
                // User select the same number in select
                || (req.body.mobile_phone_number
                    && req.body.landline_phone_number
                    && req.body.mobile_phone_number === req.body.landline_phone_number))) {

            addInvalidRequestErrors({
                mobile_phone_number_number: 'This number cannot be the same than landline number.',
                landline_phone_number_number: 'This number cannot be the same than mobile number.'
            });
        }
        
        if (Object.keys(invalidRequestErrors).length 
            || Object.keys(validationErrors).length
            || serverErrors.length) {

            if (revertFns.length) {
                return async.series(revertFns, errCallback);
            }

            return errCallback();
        }

        next();
    };

    if (fnsToCall.length) {
        return async.series(fnsToCall, endCallback);
    }

    endCallback();
};