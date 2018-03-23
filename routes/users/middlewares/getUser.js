var assert = require('assert');
var async = require('async');

var config = require('../../../config');

var db = require('../../../models');

var localesData = require('../../../locales/data');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var findUserAuthorizationForClient = require('../../../models/actions/findUserAuthorizationForClient');
var findOrCreateTestUser = require('../../../models/actions/findOrCreateTestUser');

var populateUserAuthorizationEntities = require('../../../models/actions/populateUserAuthorizationEntities');
var updateOauthUserStatus = require('../../../models/actions/updateOauthUserStatus');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (req, res, next) {
    var context = this;
    var whenShowingAuthorizedClient = context 
                                   && context.name === 'showAuthorizedClientToUser';

    var currentLocale = req.i18n.getLocale();

    var user = res.locals.user;
    // See `findRealIDForClientSpecificID` middleware
    var userID = res.locals.realUserID || req.params[0];

    var oauthAuthorization = res.locals.accessToken.authorization;

    var clientEntityIDForUserFn = res.locals.clientEntityIDForUser;
    var clientEntityIDForUser = function () {
        var arguments = Array.prototype.slice.call(arguments);

        var ID = clientEntityIDForUserFn.apply(this, arguments);

        // Make sure we have client 
        // specific ID for this entity
        // This assert has discovered MANY BUGS. LOVE IT !
        assert.ok(!!ID, 'Client specific ID must be set');

        return ID;
    };

    var userUseTestAccount = false;

    // Don't check when called as function in code
    if (!whenShowingAuthorizedClient
        // Make sure viewed user is access token user
        && user.id !== userID) {
        
        return next(new AccessDeniedError());
    }

    // User is on the app
    if (oauthAuthorization.hasAppScope()
        && !whenShowingAuthorizedClient) {

        async.auto({
            populateUser: function (cb) {
                var opts = [
                    // We need main email address
                    // to display gravatar
                    {
                        path: 'emails',
                        match: {
                            is_main_address: true
                        }
                    },

                    // Used to fill the `Clients` section on the left
                    {
                        path: 'developer.clients',
                        select: 'name'
                    },

                    // Used to fill the `Authorizations` 
                    // section on the left `client_id` 
                    // is taken to choose the flow to redirect user to
                    // when he try to recover password while logged 
                    // during oauth authorize low
                    // (we can't redirect to login flow if 
                    // user hasn't authorized client, and conversely for registration)
                    {
                        path: 'authorized_clients',
                        select: 'name client_id'
                    }
                ];

                db.models.User.populate(user, opts, function (err, user) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, user);
                });
            }
        }, function (err, results) {
            var user = results && results.populateUser;

            if (err) {
                return next(err);
            }
            
            res.send({
                user: user.toObject(),
                months: localesData[currentLocale].months,
                territories: localesData[currentLocale].territories,
                nationalities: localesData[currentLocale].nationalities,
                timezones: localesData[currentLocale].timezones
            });
        });
    } else { 
        // Client access user information 
        // or user see client in app in the authorizations section
        async.auto({
            // Find to check if use user test account
            // and to send updated fields (if any)
            // along with user object in order to 
            // ease the process for client to manage updates
            findOauthUserStatus: function (cb) {
                // User on app doesn't want to see 
                // updated fields for this client
                if (whenShowingAuthorizedClient) {
                    return cb(null);
                }

                db.models.OauthUserStatus.findOne({
                    client: oauthAuthorization.issued_to.client,
                    user: user.id
                }, function (err, oauthUserStatus) {
                    if (err) {
                        return cb(err);
                    }

                    userUseTestAccount = oauthUserStatus.use_test_account;

                    cb(null, oauthUserStatus);
                });
            },

            // Populate email field
            // to allow getting gravatar
            populateUser: ['findOauthUserStatus', function (cb) {
                var opts = [
                    {
                        path: 'emails',
                        match: {
                            is_main_address: true
                        }
                    }
                ];

                if (userUseTestAccount
                    || user.hasProfilPhoto()) {
                    
                    return cb(null, user);
                }

                db.models.User.populate(user, opts, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            findOrCreateTestUser: ['findOauthUserStatus', function (cb, results) {
                var oauthUserStatus = results.findOauthUserStatus;

                if (whenShowingAuthorizedClient) {
                    return cb(null);
                }

                if (!userUseTestAccount
                    // We need test user if client 
                    // has updated redirection uri scope
                    // between test and registration. See below.
                    && oauthUserStatus.status !== 'existing_user_after_test') {
                    
                    return cb(null);
                }

                findOrCreateTestUser(currentLocale,
                                     user.id, 
                                     oauthAuthorization.issued_to.client, 
                                     function (err, testUser) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, testUser);
                });
            }],

            findUserAuthorizationForClient: ['populateUser', 'findOrCreateTestUser', function (cb, results) {
                var userAuthorization = null;
                var addresses = [];

                // We pass authorized scope 
                // because we want full scope
                // not just scope bounds to 
                // access token oauthAuthorization
                if (whenShowingAuthorizedClient) {
                    return cb(null, context.userAuthorizationForClient);
                }

                if (userUseTestAccount) {
                    return cb(null);
                }

                findUserAuthorizationForClient(user.id, 
                                               oauthAuthorization.issued_to.client, 
                                               function (err, userAuthorization) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            populateAuthorizedEntities: ['findUserAuthorizationForClient', function (cb, results) {
                var testUser = results.findOrCreateTestUser;
                var userAuthorization = results.findUserAuthorizationForClient;

                if (userUseTestAccount) {
                    return cb(null);
                }

                populateUserAuthorizationEntities(userAuthorization, 
                                                  function (err, populatedUserAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, populatedUserAuthorization);
                });
            }],

            constructUserToSend: ['populateAuthorizedEntities', function (cb, results) {
                var testUser = results.findOrCreateTestUser;
                var userAuthorization = results.populateAuthorizedEntities;
                var oauthUserStatus = results.findOauthUserStatus;

                var clientWantsSpecificPhoneType = oauthAuthorization.scope_flags
                                                        .indexOf('mobile_phone_number') !== -1 
                                                   || oauthAuthorization.scope_flags
                                                        .indexOf('landline_phone_number') !== -1;

                var pluralScope = config.EVENID_OAUTH.PLURAL_SCOPE;
                var fieldsUpdatedByUser = (!whenShowingAuthorizedClient 
                                           && !userUseTestAccount 
                                           && oauthUserStatus.updated_fields) || [];

                var userToSend = {};
                var deletedEntities = [];

                userToSend = {
                    id: !whenShowingAuthorizedClient
                        // All issued ID needs to be 'client specific'
                        ? clientEntityIDForUser('users', 'fake', user.id) 
                        : user.id
                };

                if (!whenShowingAuthorizedClient) {
                    if (['new_user', 'existing_user'].indexOf(oauthUserStatus.status) === -1) {
                        // `updated_fields` field contains 
                        // ALL updated field not only the one 
                        // wanted by client. See the pre save 
                        // middleware `updateOauthUserStatus`.
                        fieldsUpdatedByUser = fieldsUpdatedByUser.filter(function (updatedField) {
                            return oauthAuthorization.scope.indexOf(updatedField) !== -1;
                        });
                    } else {
                        // User could have updated field before client
                        // calls the GET user API method first time
                        fieldsUpdatedByUser = [];
                    }

                    userToSend.status = oauthUserStatus.status;
                    userToSend.updated_fields = fieldsUpdatedByUser;
                    userToSend.is_test_account = userUseTestAccount;
                }

                // Test account doesn't have 
                // attached user authorization
                // so mock it now
                if (userUseTestAccount) {
                    // User authorization doesn't exist 
                    // here given that user use a test account
                    userAuthorization = {
                        entities: {
                            emails: testUser.emails,
                            phone_numbers: [],
                            addresses: testUser.addresses
                        }
                    };

                    // Client wants phone number...
                    if (oauthAuthorization.scope.indexOf('phone_numbers') !== -1) {
                        // ...specificaly mobile phone number
                        if (oauthAuthorization.scope_flags.indexOf('mobile_phone_number') !== -1) {
                            userAuthorization.entities
                                             .phone_numbers
                                             .push(testUser.mobile_phone_numbers[0]);
                        }

                        // ...specificaly landline number
                        if (oauthAuthorization.scope_flags.indexOf('landline_phone_number') !== -1) {
                            userAuthorization.entities
                                             .phone_numbers
                                             .push(testUser.landline_phone_numbers[0]);
                        }

                        // Client doesn't want specific phone type
                        // We reuse mobile number given that some 
                        // countries (like FR) doesn't have unknown numbers
                        if (userAuthorization.entities.phone_numbers.length === 0) {
                            userAuthorization.entities
                                             .phone_numbers
                                             .push(testUser.mobile_phone_numbers[0]);
                        }
                    }
                }

                // When showing authorized client 
                // to user we want FULL scope 
                // not the one bound to the 
                // oauth authorization (scope = ['app'])
                (whenShowingAuthorizedClient 
                    ? userAuthorization 
                    : oauthAuthorization).scope.forEach(function (scopeValue) {
                    
                    // Addresses, emails or phone numbers
                    if (pluralScope.indexOf(scopeValue) !== -1) {
                        // First value added for this entity
                        if (!userToSend[scopeValue]) {
                            userToSend[scopeValue] = [];
                            // Not used when showing client to user
                            if (!whenShowingAuthorizedClient) {
                                // Hook push method in order to add `status` 
                                // and `updated_fields property
                                // to all plural entities
                                userToSend[scopeValue].push = function () {
                                    var currentArray = this;
                                    // Entities that need to be appended.
                                    // Slice to get a real JS array.
                                    var entities = Array.prototype.slice.call(arguments);

                                    entities.forEach(function (entity) {
                                        var status = 'old'; 
                                        var updatedFields = [];

                                        // The first time client call this 
                                        // method for an user all entities are new
                                        if (oauthUserStatus.status === 'new_user') {
                                            status = 'new';
                                        } else if (oauthUserStatus.status !== 'existing_user') {
                                            
                                            if (oauthUserStatus.status === 'existing_user_after_test') {
                                                // First login after test -> By default, 
                                                // all entity fields need to be updated.
                                                status = 'updated';
                                                
                                                // All fields that compose this entity
                                                updatedFields = config.EVENID_OAUTH
                                                                      .VALID_ENTITY_FIELDS[scopeValue.toUpperCase()];

                                                // If client update redirection URI scope after user 
                                                // has used test account but before it register for real
                                                // or if user authorize another address during `existing_user_after_test`
                                                // status may be set to `new`.
                                                oauthUserStatus['updated_' + scopeValue].forEach(function (updatedEntity) {
                                                    if (updatedEntity.id.toString() !== entity.id.toString()) {
                                                        return;
                                                    }

                                                    if (updatedEntity.status === 'new') {
                                                        status = 'new';
                                                        updatedFields = [];

                                                        return;
                                                    }
                                                });
                                            } else if (oauthUserStatus.status === 'existing_user_after_update') {
                                                // User has given access to new entity
                                                // or has updated entity used by client
                                                // or client has updated redirection uri scope.
                                                // Could be `new` or `updated`.
                                                oauthUserStatus['updated_' + scopeValue].forEach(function (updatedEntity) {
                                                    if (updatedEntity.id.toString() !== entity.id.toString()) {
                                                        // User has deleted an entity 
                                                        // (At this time, only addresses)
                                                        if (updatedEntity.status === 'deleted') {
                                                            if (!deletedEntities[scopeValue]) {
                                                                deletedEntities[scopeValue] = [];
                                                            }

                                                            deletedEntities[scopeValue].push({
                                                                id: clientEntityIDForUser(scopeValue, 'fake', updatedEntity.id).toString(),
                                                                status: 'deleted',
                                                                updated_fields: []
                                                            });
                                                        }

                                                        return;
                                                    }

                                                    if (updatedEntity.status === 'new') {
                                                        status = 'new';
                                                        updatedFields = [];

                                                        return;
                                                    }

                                                    // Status may be `new` followed by `updated` 
                                                    // if client doesn't have called the GET user api method 
                                                    // between the creation and the update. Make sure to send `new` in this case.
                                                    if (status !== 'new') {
                                                        status = 'updated';

                                                        // Use concat here, user may have made multiple updates
                                                        updatedFields = updatedFields.concat(updatedEntity.updated_fields
                                                                                                          .filter(function (updatedField) {
                                                            // User may have updated same field, multiple time 
                                                            // before client call the GET user api method 
                                                            return updatedFields.indexOf(updatedField) === -1;
                                                        }));
                                                    }
                                                });
                                            }
                                        }

                                        // If user uses test account 
                                        // TestAccount model entities ID 
                                        // are used as fake IDs
                                        if (!userUseTestAccount) {
                                            // Entity name depends on phone type
                                            if (currentArray === userToSend.phone_numbers) {
                                                entity.id = clientEntityIDForUser(entity.phone_type + '_phone_numbers', 
                                                                                  'fake',
                                                                                  entity.id);
                                            } else {
                                                // All issued ID needs to be 'client specific'
                                                entity.id = clientEntityIDForUser(scopeValue, 'fake', entity.id);
                                            }
                                        }
                                        
                                        entity.status = status;
                                        entity.updated_fields = updatedFields;

                                        // Don't use push here 
                                        // given that we have hooked it
                                        currentArray[currentArray.length] = entity;
                                    });

                                    // Original push method returns 
                                    // the new length of the array
                                    // so... do the same!
                                    return currentArray.length;
                                };
                            }
                        }

                        if (scopeValue === 'emails') {
                            userAuthorization.entities.emails.forEach(function (email) {
                                userToSend.emails.push({
                                    id: email.id,
                                    address: email.address,
                                    is_verified: email.is_verified
                                });
                            });

                            return;
                        }

                        if (scopeValue === 'phone_numbers') {
                            userAuthorization.entities.phone_numbers.forEach(function (phoneNumber) {
                                // User may have authorized many phone numbers 
                                // if client has updated its redirection uri scope afterwards.
                                // Make sure we send only one phone number per phone type
                                if (!whenShowingAuthorizedClient) {
                                    if (clientWantsSpecificPhoneType) {
                                        if (phoneNumber.phone_type === 'mobile' 
                                            && oauthAuthorization.scope_flags
                                                                 .indexOf('mobile_phone_number') === -1) {

                                            return;
                                        }

                                        if (phoneNumber.phone_type === 'landline' 
                                            && oauthAuthorization.scope_flags
                                                                 .indexOf('landline_phone_number') === -1) {

                                            return;
                                        }

                                        if (phoneNumber.phone_type === 'unknown') {
                                            return;
                                        }
                                    }
                                }

                                userToSend.phone_numbers.push({
                                    id: phoneNumber.id,
                                    number: whenShowingAuthorizedClient   
                                            ? phoneNumber.number 
                                            : phoneNumber.international_number,
                                    phone_type: phoneNumber.phone_type
                                });
                            });

                            // Client ask for unknown phone number, an 
                            // unknown phone number was passed. Then, client now ask
                            // for mobile and landline phone number, a mobile and landline 
                            // phone number was passed. Finally client re-ask for unknow phone number
                            // and we have three numbers in the array ! Houston, we have a problem
                            // This ALSO WORK when client ask for: mobile/landline -> unknown (Two numbers in array)
                            if (!clientWantsSpecificPhoneType
                                && userToSend.phone_numbers.length > 1
                                && !whenShowingAuthorizedClient) {

                                // Send unknown phone number if any, 
                                // mobile phone number if any, landline otherwise.
                                (function () {
                                    var filterPhonesByID = function (ID) {
                                        return function (phoneNumber) {
                                            return phoneNumber.id === ID;
                                        };
                                    };

                                    var unknownPhoneNumber = null;
                                    var mobilePhoneNumber = null;
                                    var landlinePhoneNumber = null;

                                    var unknownPhoneNumberID = null;
                                    var mobilePhoneNumberID = null;
                                    var landlinePhoneNumberID = null;

                                    /* Use function directly to 
                                       not trigger assert error */

                                    unknownPhoneNumberID = clientEntityIDForUserFn('unknown_phone_numbers', 'fake');

                                    mobilePhoneNumberID = clientEntityIDForUserFn('mobile_phone_numbers', 'fake');

                                    landlinePhoneNumberID = clientEntityIDForUserFn('landline_phone_numbers', 'fake');

                                    /* END */

                                    unknownPhoneNumber = userToSend.phone_numbers
                                                                   .filter(filterPhonesByID(unknownPhoneNumberID))[0];

                                    mobilePhoneNumber = userToSend.phone_numbers
                                                                  .filter(filterPhonesByID(mobilePhoneNumberID))[0];

                                    landlinePhoneNumber = userToSend.phone_numbers
                                                                    .filter(filterPhonesByID(landlinePhoneNumberID))[0];

                                    if (unknownPhoneNumber) {
                                        userToSend.phone_numbers = [unknownPhoneNumber];
                                    } else if (mobilePhoneNumber) {
                                        userToSend.phone_numbers = [mobilePhoneNumber];
                                    } else {
                                        userToSend.phone_numbers = [landlinePhoneNumber];
                                    }
                                })();

                                // Make sure phone numbers 
                                // were successfully filtered
                                assert.strictEqual(userToSend.phone_numbers.length, 1);
                            }

                            return;
                        }

                        if (scopeValue === 'addresses') {
                            userAuthorization.entities.addresses.forEach(function (address) {
                                var clientWantsShippingAddress = !whenShowingAuthorizedClient 
                                                                    && oauthAuthorization
                                                                        .scope_flags
                                                                        .indexOf('separate_shipping_billing_address') !== -1;
                                
                                // Don't use the `toObject` function here,
                                // many address properties
                                // MUST NOT be sent to the client
                                var addressAsObj = {
                                    id: address.id,
                                    address_type: address.address_type,
                                    full_name: address.full_name,
                                    address_line_1: address.address_line_1,
                                    address_line_2: address.address_line_2 || '',
                                    access_code: address.access_code || '',
                                    city: address.city,
                                    state: address.state || '',
                                    postal_code: address.postal_code,
                                    country: address.country,
                                    first_for: []
                                };
                                
                                // If user has chosen shipping and billing
                                // address on login their will be set
                                // on oauth authorization `user.addresses` property
                                // idem for address which must be selected first
                                if (!whenShowingAuthorizedClient) {
                                    if (!userUseTestAccount) {
                                        
                                        if (clientWantsShippingAddress) {
                                            // Oauth authorization 
                                            // contain `for` attribute 
                                            // for shipping/billing 
                                            // separated addresses
                                            oauthAuthorization.user.addresses.forEach(function (addressObj) {
                                                if (addressObj.address.toString() !== address.id.toString()) {
                                                    return;
                                                }

                                                addressAsObj.first_for = addressObj['for'];
                                            });
                                        } else if (userAuthorization.address_to_be_selected_first
                                                   && userAuthorization.address_to_be_selected_first
                                                                       .toString() === address.id) {
                                            
                                            // User authorization 
                                            // contain `for` attribute 
                                            // for non-separated addresses
                                            addressAsObj.first_for = ['addresses'];
                                        }
                                    }
                                }

                                userToSend.addresses.push(addressAsObj);
                            });

                            return;
                        }

                        return;
                    } // End plural entities

                    // Authorization scope fields match 
                    // user properties for single fields
                    userToSend[scopeValue] = (userUseTestAccount ? testUser : user)[scopeValue];

                    // Send a timestamp
                    if (scopeValue === 'date_of_birth') {
                        // Timestamp in seconds
                        userToSend[scopeValue] = (userToSend[scopeValue].getTime() / 1000);
                    }
                });

                if (Object.keys(deletedEntities).length) {
                    Object.keys(deletedEntities).forEach(function (entityName) {
                        deletedEntities[entityName].forEach(function (entity) {
                            // Push method is hooked !!
                            userToSend[entityName][userToSend[entityName].length] = entity;
                        });
                    });
                }

                cb(null, userToSend);
            }],

            // If client has updated redirection URI 
            // scope during testing, we need 
            // to update `status` and `updated_fields` 
            // accordingly
            updateTestAccountSentFields: ['constructUserToSend', function (cb, results) {
                var oauthUserStatus = results.findOauthUserStatus;
                var userToSend = results.constructUserToSend;
                var testUser = results.findOrCreateTestUser;

                var userToSendScopeKeys = Object.keys(userToSend).filter(function (v) {
                    return config.EVENID_OAUTH
                                 .VALID_USER_SCOPE
                                 .indexOf(v) !== -1;
                });
                var userToSendEntities = [].concat(
                    userToSend.emails || [],
                    userToSend.phone_numbers || [],
                    userToSend.addresses || []
                ).map(function (v) {
                    return v.id;
                });
                var userToSendUpdatedFields = [];

                var alreadySentFields = [];
                var alreadySentEntities = [];

                var clientHasUpdatedAskedScope = false;

                var objectIDToString = function (v) {
                    return v.toString();
                };

                if (whenShowingAuthorizedClient) {
                    return cb(null);
                }

                if (!userUseTestAccount) {
                    return cb(null);
                }

                if (oauthUserStatus.status !== 'new_user') {
                    alreadySentFields = testUser.sent_fields;
                    alreadySentEntities = testUser.sent_entities.map(objectIDToString);

                    userToSendScopeKeys.forEach(function (scopeVal) {
                        // The field was already asked by client
                        if (alreadySentFields.indexOf(scopeVal) !== -1
                            // In case of plural scope value 
                            // (Emails, Phone numbers, Addresses)
                            // We need to parse all entities 
                            // to see if all entities were sent
                            && config.EVENID_OAUTH
                                     .PLURAL_SCOPE.indexOf(scopeVal) === -1) {
                            
                            return;
                        }

                        // The field was not already asked by client
                        if (alreadySentFields.indexOf(scopeVal) === -1) {
                            clientHasUpdatedAskedScope = true;
                            userToSendUpdatedFields.push(scopeVal);
                        }

                        // Singular fields ?
                        if (config.EVENID_OAUTH
                                  .PLURAL_SCOPE
                                  .indexOf(scopeVal) === -1) {
                            
                            return;
                        }

                        // We need to parse all entities 
                        // to see if all entities were sent
                        userToSend[scopeVal].forEach(function (entity) {
                            // Entity was already sent
                            if (alreadySentEntities.indexOf(entity.id) !== -1) {
                                return;
                            }

                            clientHasUpdatedAskedScope = true;
                            entity.status = 'new';

                            // Even if field was already asked by client
                            // make sure the user `updated_fields` field contains
                            // entity name
                            if (userToSendUpdatedFields.indexOf(scopeVal) === -1) {
                                userToSendUpdatedFields.push(scopeVal);
                            }
                        });
                    });

                    if (clientHasUpdatedAskedScope) {
                        userToSend.status = 'existing_user_after_update';
                        userToSend.updated_fields = userToSendUpdatedFields;
                    }
                }

                db.models.TestUser.update({
                    user: user.id, 
                    client: oauthAuthorization.issued_to.client
                }, {
                    // Append missing values
                    $addToSet: {
                        sent_fields: {
                            $each: userToSendScopeKeys
                        },

                        sent_entities: {
                            $each: userToSendEntities
                        }
                    }
                }, function (err, rawResponse) {
                    if (err) {
                        return cb(err);
                    }

                    // Returns updated user to send
                    cb(null, userToSend);
                });
            }],

            // Back to `existing_user` user status
            // only when client has successfully getting user
            // Make sure to set this action AT THE END.
            // We MUST NOT update user status in case of errors.
            updateOauthUserStatus: ['constructUserToSend', function (cb, results) {
                var currentUserStatus = results.findOauthUserStatus;
                var update = {
                    // We need to overwrite this fields
                    $set: {
                        status: 'existing_user',
                        updated_fields: [],
                        updated_emails: [],
                        updated_phone_numbers: [],
                        updated_addresses: []
                    }
                };

                // User on app
                if (whenShowingAuthorizedClient) {
                    return cb(null);
                }

                // Nothing to do
                if (currentUserStatus.status === 'existing_user') {
                    return cb(null);
                }

                updateOauthUserStatus([oauthAuthorization.issued_to.client], 
                                      user.id, 
                                      update, 
                                      function (err, rawResponse) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }]
        }, function (err, results) {
            var userToSend = results && results.constructUserToSend;

            if (err) {
                return next(err);
            }

            // `next` was mocked
            if (whenShowingAuthorizedClient) {
                return next(null, userToSend);
            }

            res.send(userToSend);
        });
    }
};