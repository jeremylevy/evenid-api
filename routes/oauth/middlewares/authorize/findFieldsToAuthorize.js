var async = require('async');

var db = require('../../../../models');

var findUserAuthorizationForClient = require('../../../../models/actions/findUserAuthorizationForClient');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var accessToken = res.locals.accessToken;

    var redirectionURI = null;
    var askedScope = [];

    var askedScopeFlags = [];
    var remainingScope = [];

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `findFieldsToAuthorize` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `findFieldsToAuthorize` '
                        + 'middleware');
    }

    if (!accessToken) {
        throw new Error('`accessToken` must be set as response locals '
                        + 'property before calling `findFieldsToAuthorize` '
                        + 'middleware');
    }

    redirectionURI = client.redirection_uris[0];

    // Make a copy to avoid modifing response local var
    askedScope = [].concat(redirectionURI.scope);
    askedScopeFlags = [].concat(redirectionURI.scope_flags);

    async.auto({
        findUserAuthorizationForClient: function (cb, results) {
            var userAuthorizationForClient = res.locals.userAuthorizationForClient;
            var callback = function (err, userAuthorization) {
                // User authorization is always set 
                // (may be set with empty values)
                var authorizedScope = userAuthorization.scope;
                var authorizedScopeFlags = userAuthorization.scope_flags;

                if (err) {
                    return cb(err);
                }

                // Used in `prepareOauthAuthorization` middleware in order
                // to avoid doing the same request multiple times
                // And to check if registered user try to register once again
                // in `authorizeLoggeduser` GET and `authorizeUnloggedUser` POST methods
                res.locals.userAuthorizationForClient = userAuthorization;

                // Remaining scope equals asked scope minus authorized scope
                remainingScope = askedScope.filter(function (scopeValue) {
                    return authorizedScope.indexOf(scopeValue) === -1;
                });

                // User has already authorized phone number...
                if (authorizedScope.indexOf('phone_numbers') !== -1) {
                    // But client now wants mobile phone number
                    if ((askedScopeFlags.indexOf('mobile_phone_number') !== -1
                        // And user doesn't have authorized this type
                         && authorizedScopeFlags.indexOf('mobile_phone_number') === -1)
                        // Or client now wants landline phone number
                        || (askedScopeFlags.indexOf('landline_phone_number') !== -1
                             // And user doesn't have authorized this type
                            && authorizedScopeFlags.indexOf('landline_phone_number') === -1)) {

                        // We need to authorize, one or many phone numbers
                        remainingScope.push('phone_numbers'); 

                        // User has already authorized mobile phone number
                        if (askedScopeFlags.indexOf('mobile_phone_number') !== -1
                            && authorizedScopeFlags.indexOf('mobile_phone_number') !== -1) {

                            // Remove from asked scope flags to not ask for it once again
                            askedScopeFlags = askedScopeFlags.filter(function (scopeFlag) {
                                return scopeFlag !== 'mobile_phone_number';
                            });
                        }

                        // User has already authorized landline phone number
                        if (askedScopeFlags.indexOf('landline_phone_number') !== -1
                            && authorizedScopeFlags.indexOf('landline_phone_number') !== -1) {

                            // Remove from asked scope flags to not ask for it once again
                            askedScopeFlags = askedScopeFlags.filter(function (scopeFlag) {
                                return scopeFlag !== 'landline_phone_number';
                            });
                        }
                    }
                }

                // Client have asked for shipping and billing address
                if (askedScopeFlags.indexOf('separate_shipping_billing_address') !== -1
                    // And user has already authorized address
                    && authorizedScope.indexOf('addresses') !== -1) {

                    // Ask for billing and shipping address on each login
                    remainingScope.push('addresses');
                }

                // Used to updated oauth user status when the 
                // client has updated redirection uri scope
                res.locals.userWasForcedToAuthorizeAdditionalFields = false;
                res.locals.additionalScope = [];

                // User has already authorized client
                if (authorizedScope.length > 0
                    // and client has updated redirection uri scope
                    && remainingScope.length > 0) {

                    res.locals.userWasForcedToAuthorizeAdditionalFields = true;
                    res.locals.additionalScope = remainingScope;
                }

                cb(null, userAuthorization);
            };

            // May be given by `checkUserCanUseTestAccount` middleware
            // Avoid doing the same request multiple times
            if (userAuthorizationForClient) {
                return callback(null, userAuthorizationForClient);
            }

            findUserAuthorizationForClient(user._id, client._id, callback);
        },

        distinguishFieldsToAuthOrFill: ['findUserAuthorizationForClient', function (cb, results) {
            var fieldsToShow = [];
            var fieldsToAuthorize = {};

            var fieldsToAuthorizeOrder = [
                'email',
                'nickname', 'profil_photo', 
                'first_name', 
                'last_name', 'date_of_birth',
                'gender', 'place_of_birth',
                'nationality', 'timezone',
                'phone_number',
                'landline_phone_number',
                'mobile_phone_number',
                'address',
                'shipping_address',
                'billing_address'
            ];

            // Used as helper in views to display
            // text in separator (ie: `and needs your address` or `Your address`...)
            var hasUserFieldsToShow = false;

            var addFieldToShow = function (fieldToShow) {
                fieldsToShow.push(fieldToShow);

                // Addresses are displayed as separate section
                if (['address', 'shipping_address', 'billing_address'].indexOf(fieldToShow) === -1) {
                    hasUserFieldsToShow = true;
                }
            };

            var setResLocals = function (fieldsToShow, fieldsToAuthorize, 
                                         hasUserFieldsToShow) {

                var sortedFieldsName = Object.keys(fieldsToAuthorize)
                                             .sort(function (a, b) {
                    
                    return fieldsToAuthorizeOrder.indexOf(a) 
                         - fieldsToAuthorizeOrder.indexOf(b);
                });
                var sortedFieldsToAuth = {};

                sortedFieldsName.forEach(function (fieldName) {
                    sortedFieldsToAuth[fieldName] = fieldsToAuthorize[fieldName];
                });

                res.locals.fieldsToShow = fieldsToShow;

                res.locals.fieldsToAuthorize = sortedFieldsToAuth;

                res.locals.hasUserFieldsToShow = hasUserFieldsToShow;
            };

            var userPopulateOpts = [
                {
                    path: 'emails'
                },

                {
                    path: 'addresses'
                },
                
                {
                    path: 'phone_numbers'
                }
            ];

            // User has already authorized client
            if (remainingScope.length === 0) {
                setResLocals(fieldsToShow, 
                             fieldsToAuthorize, 
                             hasUserFieldsToShow);

                return cb(null);
            }

            // Populate user in order to distinguish
            // between multiple fields (emails, addresses...)
            // which must be authorized and
            // which must be filled
            db.models.User.populate(user, userPopulateOpts, function (err, user) {
                var scopeFlags = null;

                var getUserEmails = function () {
                    var emails = user.emails;

                    return emails.length && emails.map(function (email) {
                        return email.toObject();
                    });
                };

                var getUserAddresses = function () {
                    var addresses = user.addresses;

                    return addresses.length && addresses.map(function (address) {
                        return address.toObject();
                    });
                };
                var addresses = null;
                var addressFieldName = null;

                var getUserPhoneNumbers = function (phoneType) {
                    var phoneNumbers = user.phone_numbers;
                    var wantedPhoneNumbers = [];
                    var phoneNumber = null;
                    
                    if (!phoneType) {
                        return phoneNumbers.length && phoneNumbers.map(function (phoneNumber) {
                            return phoneNumber.toObject();
                        });
                    }

                    for (var i = 0, j = phoneNumbers.length; i < j; ++i) {
                        phoneNumber = phoneNumbers[i];

                        if (phoneNumber.phone_type === phoneType) {
                            wantedPhoneNumbers.push(phoneNumber.toObject());
                        }
                    }

                    return wantedPhoneNumbers.length ? wantedPhoneNumbers : undefined;
                };
                var phoneNumbers = null;
                var wantedPhoneNumberFields = [];
                var wantedPhoneNumberType = null;

                if (err) {
                    return cb(err);
                }
                
                for (var i = 0, j = remainingScope.length; i < j; ++i) {
                    if ('emails' === remainingScope[i]) {
                        // User has implicitly given access to his email during
                        // login on client form
                        if (accessToken.logged_by_client
                            && accessToken.logged_by_client.toString() === client.id) {

                            continue;
                        }

                        // We are sure that user has
                        // at least one email address
                        fieldsToAuthorize.email = getUserEmails();

                        continue;
                    }

                    if ('addresses' === remainingScope[i]) {
                        addresses = getUserAddresses();

                        (askedScopeFlags.indexOf('separate_shipping_billing_address') !== -1 
                         ? ['shipping_address', 'billing_address'] 
                         : ['address']).forEach(function (field) {

                            // User has addresses
                            if (addresses) {
                                fieldsToAuthorize[field] = addresses;
                            } else {
                                addFieldToShow(field);
                            }
                        });

                        continue;
                    }

                    if ('phone_numbers' === remainingScope[i]) {
                        // App doesn't want to distinguish 
                        // between landline and mobile number
                        if (askedScopeFlags.indexOf('mobile_phone_number') === -1
                            && askedScopeFlags.indexOf('landline_phone_number') === -1) {
                            
                            phoneNumbers = getUserPhoneNumbers();

                            if (phoneNumbers) {
                                fieldsToAuthorize.phone_number = phoneNumbers;
                            } else {
                                addFieldToShow('phone_number');
                            }
                        } else {
                            if (askedScopeFlags.indexOf('mobile_phone_number') !== -1) {
                                wantedPhoneNumberFields.push('mobile_phone_number');
                            }

                            if (askedScopeFlags.indexOf('landline_phone_number') !== -1) {
                                wantedPhoneNumberFields.push('landline_phone_number');
                            }

                            wantedPhoneNumberFields.forEach(function (field) {
                                // Equals to 'landline' or 'mobile'
                                wantedPhoneNumberType = field.replace(/_phone_number$/, '');
                                
                                // Concat phone number with specified type
                                // and phone numbers whose type we don't known
                                phoneNumbers = (getUserPhoneNumbers(wantedPhoneNumberType) || [])
                                               .concat(getUserPhoneNumbers('unknown') || []);

                                // User has this kind of phone numbers
                                if (phoneNumbers.length) {
                                    fieldsToAuthorize[field] = phoneNumbers;
                                } else {
                                    addFieldToShow(field);
                                }
                            });
                        }

                        continue;
                    }

                    // If the user has already completed the field
                    if (
                        (user[remainingScope[i]]
                            && remainingScope[i] !== 'profil_photo')
                        
                        || (remainingScope[i] === 'profil_photo'
                            && user.hasProfilPhoto())
                        ) {

                        // Display `This application will be allowed to access to:`
                        fieldsToAuthorize[remainingScope[i]] = user[remainingScope[i]];

                        continue;
                    }

                    // Otherwise he must fill field
                    addFieldToShow(remainingScope[i]);
                } // End for

                // Given that profil photo
                // is optional, its better to set it as
                // field to show when its the 
                // sole field to authorize or as field to authorize 
                // when its the sole field to show. Better UI.
                if (Object.keys(fieldsToAuthorize).length === 1
                    && fieldsToAuthorize.profil_photo
                    && hasUserFieldsToShow) {

                    delete fieldsToAuthorize.profil_photo;

                    addFieldToShow('profil_photo');
                } else if (fieldsToShow.length === 1
                           && fieldsToShow.indexOf('profil_photo') !== -1
                           && Object.keys(fieldsToAuthorize).length) {

                    fieldsToAuthorize.profil_photo = user.profil_photo;

                    fieldsToShow = [];
                    hasUserFieldsToShow = false;
                }
                
                setResLocals(fieldsToShow, 
                             fieldsToAuthorize, 
                             hasUserFieldsToShow);

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return next(err);
        }

        next();
    });
};