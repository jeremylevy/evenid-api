var assert = require('assert');
var Type = require('type-of-is');

var validator = require('validator');
var async = require('async');

var mongoose = require('mongoose');

var config = require('../../config');

var areValidObjectIDs = require('../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

var isValidAlpha2CountryCode = require('../../models/validators/isValidAlpha2CountryCode');
var isValidTimezone = require('../../models/validators/isValidTimezone');

var fullScope = config.EVENID_OAUTH
                      .VALID_USER_SCOPE;

var fullScopeFlags = config.EVENID_OAUTH
                          .VALID_USER_SCOPE_FLAGS;

var phoneFields = ['phone_number_country', 'phone_number_number'];

var landlinePhoneFields = ['landline_phone_number_country', 'landline_phone_number_number'];
var mobilePhoneFields = ['mobile_phone_number_country', 'mobile_phone_number_number'];

var mobileLandlinePhoneFields = landlinePhoneFields.concat(mobilePhoneFields);

var addressFields = ['address_address_type', 'address_country', 
                     'address_postal_code', 'address_city', 
                     'address_address_line_1', 'address_full_name'];

var shippingBillingAddressFields = ['shipping_address_address_type', 'shipping_address_country', 
                                    'shipping_address_postal_code', 'shipping_address_city', 
                                    'shipping_address_address_line_1', 'shipping_address_full_name', 
                                    'billing_address_address_type', 'billing_address_country', 
                                    'billing_address_postal_code', 'billing_address_city', 
                                    'billing_address_address_line_1', 'billing_address_full_name'];

var emailFields = ['email', 'password'];

var singularFields = ['first_name', 'last_name', 
                      'nickname', 'gender', 
                      'date_of_birth', 'place_of_birth', 
                      'nationality', 'timezone'];

var fullFormFields = [].concat(singularFields,
                               phoneFields,
                               addressFields,
                               shippingBillingAddressFields, 
                               mobileLandlinePhoneFields,
                               emailFields);

// Full scope is used with `separate_shipping_billing_address`, 
// `mobile_phone_number` and `landline_phone_number` flags
var formFieldsMatchingFullScope = fullFormFields.filter(function (field) {
    return [].concat(phoneFields, addressFields).indexOf(field) === -1;
});

var invalidFormFields = ['date_of_birth', 'place_of_birth',
                         'nationality', 'timezone',
                         'shipping_address_address_type', 'shipping_address_country',
                         'billing_address_address_type', 'billing_address_country',
                         'landline_phone_number_number', 'mobile_phone_number_number',
                         'email', 'password', 'gender'];

var validFormData = function (user) {
    return function (formFields) {
        var formData = {};

        (formFields || fullFormFields).forEach(function (formField) {
            // We use unique value here, because we may want 
            // to ensure that received user match passed data. See below.
            formData[formField] = mongoose.Types.ObjectId().toString();

            if (formField === 'email') {
                formData[formField] = 'bar' + mongoose.Types.ObjectId().toString() + '@evenid.com';
                formData.password = user.password;
            }

            if (formField === 'password') {
                formData.password = user.password;
            }

            if (formField === 'nickname') {
                formData[formField] = mongoose.Types.ObjectId().toString();
            }

            if (formField === 'gender') {
                formData[formField] = 'female';
            }

            if (formField === 'date_of_birth') {
                delete formData[formField];
                
                formData.date_of_birth_month = '05';
                formData.date_of_birth_day = '18';
                formData.date_of_birth_year = '1992';
            }

            if (formField === 'phone_number_number') {
                formData[formField] = '732-757-2923';
                formData.phone_number_country = 'US';
            }

            if (formField === 'landline_phone_number_number') {
                formData[formField] = '+33491081784';
                formData.landline_phone_number_country = 'FR';
            }

            if (formField === 'mobile_phone_number_number') {
                formData[formField] = '+33691081784';
                formData.mobile_phone_number_country = 'FR';
            }

            if (['address_address_type',
                 'shipping_address_address_type', 
                 'billing_address_address_type'].indexOf(formField) !== -1) {

                formData[formField] = 'residential';
            }

            if (['nationality',
                 'place_of_birth',
                 'address_country',
                 'shipping_address_country', 
                 'billing_address_country'].indexOf(formField) !== -1) {

                formData[formField] = 'FR';
            }

            if (formField === 'timezone') {
                formData[formField] = 'Europe/Paris';
            }
        });

        return formData;
    };
};

var assertTestUserIsValid = function (askedScope, askedScopeFlags, testUser) {
    var scopeValue = null;

    // `id`, `is_test_account`, 
    // `user_status`, `updated_fields` (4)
    assert.strictEqual(Object.keys(testUser).length, askedScope.length + 4);

    assert.ok(areValidObjectIDs([testUser.id]));

    assert.ok(config.EVENID_OAUTH
                    .VALID_USER_STATUS
                    .indexOf(testUser.status) !== -1);

    assert.ok(testUser.is_test_account);

    for (var i = 0, j = askedScope.length; i < j; ++i) {
        scopeValue = askedScope[i];

        if (singularFields.indexOf(scopeValue) !== -1) {
            if (scopeValue === 'date_of_birth') {
                assert.ok(Type.is(testUser[scopeValue], Number) 
                          && testUser[scopeValue] > 0);
                
                continue;
            }

            if (scopeValue === 'gender') {
                assert.ok(['male', 'female'].indexOf(testUser[scopeValue]) !== -1);

                continue;
            }

            if (['place_of_birth', 'nationality'].indexOf(scopeValue) !== -1) {
                assert.ok(isValidAlpha2CountryCode(testUser[scopeValue]));

                continue;
            }

            if (scopeValue === 'timezone') {
                assert.ok(isValidTimezone(testUser[scopeValue]));

                return;
            }

            assert.ok(Type.is(testUser[scopeValue], String) 
                      && testUser[scopeValue].length > 0);
        }

        if (scopeValue === 'emails') {
            assert.ok(Type.is(testUser.emails, Array));
            assert.strictEqual(testUser.emails.length, 1);

            testUser.emails.forEach(function (email) {
                assert.ok(areValidObjectIDs([email.id]));
                assert.ok(validator.isEmail(email.address));
                assert.ok(email.is_verified);
            });
        }

        if (scopeValue === 'phone_numbers') {
            assert.ok(Type.is(testUser.phone_numbers, Array));

            if (askedScopeFlags.indexOf('mobile_phone_number') !== -1
                && askedScopeFlags.indexOf('landline_phone_number') !== -1) {

                assert.strictEqual(testUser.phone_numbers.length, 2);
            } else {
                assert.strictEqual(testUser.phone_numbers.length, 1);
            }

            testUser.phone_numbers.forEach(function (phoneNumber) {
                assert.ok(areValidObjectIDs([phoneNumber.id]));

                assert.ok(!!phoneNumber.number.match(/\+[0-9]+/));

                assert.ok(['unknown', 'mobile', 'landline'].indexOf(phoneNumber.phone_type) !== -1);
            });
        }

        if (scopeValue === 'addresses') {
            assert.ok(Type.is(testUser.addresses, Array));
            assert.strictEqual(testUser.addresses.length, 1);

            testUser.addresses.forEach(function (address) {
                assert.ok(areValidObjectIDs([address.id]));
                
                assert.ok(['residential', 'comercial'].indexOf(address.address_type) !== -1);
                
                assert.ok(Type.is(address.full_name, String) 
                          && address.full_name.length > 0);

                assert.ok(Type.is(address.address_line_1, String) 
                          && address.address_line_1.length > 0);

                assert.ok(Type.is(address.address_line_2, String));

                assert.ok(Type.is(address.access_code, String));

                assert.ok(Type.is(address.city, String) 
                          && address.city.length > 0);

                assert.ok(Type.is(address.state, String));

                assert.ok(Type.is(address.postal_code, String)
                          && address.postal_code.length > 0);

                assert.ok(Type.is(address.country, String)
                          && !!address.country.match(/[A-Z]{2}/));

                address.first_for.forEach(function (forValue) {
                    assert.ok(['shipping', 'billing', 'addresses'].indexOf(forValue) !== -1);
                });
            });
        }
    }
};

var userMatchPassedData = function (passedData, user) {
    // Fields not sent when calling 
    // the GET user api method
    var fieldsNotSent = [
        'password',
        'phone_number_country', 
        'landline_phone_number_country',
        'mobile_phone_number_country'
    ];

    for (var field in passedData) {
        var correspondingUserField = null;
        var entityName = null;
        var oneEntityContainsField = false;

        if (fieldsNotSent.indexOf(field) !== -1) {
            continue;
        }

        if (singularFields.indexOf(field) !== -1) {
            // Compare timestamp
            if (!!field.match(/^date_of_birth/)) {
                if (user[field] !== new Date(
                        parseInt(passedData.date_of_birth_year),
                        // Starts at 0
                        parseInt(passedData.date_of_birth_month) - 1, 
                        parseInt(passedData.date_of_birth_day)
                    ).getTime() / 1000) {

                    return false;
                }

                continue;
            }

            if (user[field] !== passedData[field]) {
                return false;
            }

            continue;
        }

        if (emailFields.indexOf(field) !== -1) {

            entityName = 'emails';
            // user.emails[0].address
            correspondingUserField = 'address';

        } else if (addressFields.concat(shippingBillingAddressFields)
                                .indexOf(field) !== -1) {
            
            entityName = 'addresses';
            correspondingUserField = field.replace(/^(shipping_|billing_)?address_/, '');

        } else if (phoneFields.concat(mobileLandlinePhoneFields)
                              .indexOf(field) !== -1) {

            entityName = 'phone_numbers';
            correspondingUserField = field.replace(/^(landline_|mobile_)?phone_number_/, '');
        }

        if (!entityName) {
            continue;
        }

        // Make sure all entities have ID
        user[entityName].forEach(function (entity) {
            assert.ok(areValidObjectIDs([entity.id]));
        });

        // For each emails, phone numbers or addresses
        for (var i = 0, j = user[entityName].length; i < j; ++i) {
            // Try to find field in at least one entity 
            // (we tried to pass unique values, see above)
            if (user[entityName][i][correspondingUserField] === passedData[field]) {
                oneEntityContainsField = true;
                break;
            }
        }

        if (oneEntityContainsField) {
            continue;
        }

        return false;
    }

    return true;
};

module.exports = function (cb) {
    var context = this;

    var _getAppAccessToken = require('../getAppAccessToken');
    var getAppAccessToken = null;

    var createOauthClient = require('../clients/create');
    var createOauthRedirectionURI = require('../clients/createRedirectionURI');

    var findOauthClients = require('../db/findOauthClients');
    var findOauthRedirectionURI = require('../clients/findRedirectionURI');

    var app = null;

    var client = null;
    var redirectionURI = null;

    var accessToken = context && context.accessToken;
    var user = context && context.user;
    
    require('../../index')(function (err, _app) {
        if (err) {
            return cb(err);
        }

        app = _app;

        _getAppAccessToken = _getAppAccessToken(app);
        // Hook `getAppAccessToken` function in order to
        // get access to user and access token var
        getAppAccessToken = function (cb) {
            if (accessToken) {
                return cb(null, accessToken, user);
            }

            _getAppAccessToken(function (err, _accessToken, _user) {
                if (err) {
                    return cb(err);
                }

                user = _user;
                accessToken = _accessToken;

                cb(null, accessToken, user);
            });
        };

        createOauthClient = createOauthClient(app, getAppAccessToken);
        //findOauthClient = findOauthClient(app);

        createOauthRedirectionURI = createOauthRedirectionURI(app, createOauthClient);

        findOauthRedirectionURI = findOauthRedirectionURI(app);

        async.auto({
            createOauthRedirectionURI: function (cb) {
                createOauthRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        redirectionURIID: redirectionURIID
                    });
                });
            },

            findOauthClient: ['createOauthRedirectionURI', function (cb, results) {
                var resp = results.createOauthRedirectionURI;
                var accessToken = resp.accessToken;
                var clientID = resp.clientID;

                // We call DB method because we need client secret
                findOauthClients([clientID], function (err, clients) {
                    var client = clients[0].toObject({
                        hide: '',
                        getters: true,
                        transform: true
                    });

                    if (err) {
                        return cb(err);
                    }

                    // Make sure all values are string not Object IDs
                    client.client_id = client.client_id.toString();

                    cb(null, client);
                });
            }],

            findOauthRedirectionURI: ['createOauthRedirectionURI', function (cb, results) {
                var resp = results.createOauthRedirectionURI;
                var accessToken = resp.accessToken;
                var clientID = resp.clientID;
                var redirectionURIID = resp.redirectionURIID;

                findOauthRedirectionURI(accessToken, clientID, 
                                        redirectionURIID, function (err, redirectionURI) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, redirectionURI);
                });
            }]
        }, function (err, results) {
            client = results.findOauthClient;
            redirectionURI = results.findOauthRedirectionURI;

            if (err) {
                return cb(err);
            }

            cb(null, {
                app: app,
                accessToken: accessToken,
                user: user,
                client: client,
                redirectionURI: redirectionURI,
                singularFields: singularFields,
                emailFields: emailFields,
                addressFields: addressFields,
                shippingBillingAddressFields: shippingBillingAddressFields,
                fullFormFields: fullFormFields,
                formFieldsMatchingFullScope: formFieldsMatchingFullScope,
                invalidFormFields: invalidFormFields,
                landlinePhoneFields: landlinePhoneFields,
                mobilePhoneFields: mobilePhoneFields,
                mobileLandlinePhoneFields: mobileLandlinePhoneFields,
                validFormData: validFormData(user),
                userMatchPassedData: userMatchPassedData,
                assertTestUserIsValid: assertTestUserIsValid,
                fullScope: fullScope,
                fullScopeFlags: fullScopeFlags
            });
        });
    });
};