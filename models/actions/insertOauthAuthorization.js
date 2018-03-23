var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var db = require('../');

var insertOrUpdateOauthUserStatus = require('./insertOrUpdateOauthUserStatus');
var insertOauthEntitiesID = require('./insertOauthEntitiesID');

module.exports = function (userUseTestAccount, authorizedEntities, oauthAuthorization, cb) {
    assert.ok(Type.is(userUseTestAccount, Boolean),
              'argument `userUseTestAccount` must be a boolean');

    assert.ok(Type.is(authorizedEntities, Object),
              'argument `authorizedEntities` must be an object literal');

    assert.ok(Type.is(oauthAuthorization, Object),
              'argument `oauthAuthorization` must be an object literal');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    // We don't want to distinguish between mobile,
    // and landline numbers, so ease the process.
    var authorizedPhoneNumbers = [];
    var authWasGrantedToApp = false;

    var addressToBeSelectedFirst = null;

    if (authorizedEntities.unknown_phone_numbers) {
        authorizedPhoneNumbers = authorizedPhoneNumbers.concat(
            authorizedEntities.unknown_phone_numbers
        ); 
    }

    if (authorizedEntities.mobile_phone_numbers) {
        authorizedPhoneNumbers = authorizedPhoneNumbers.concat(
            authorizedEntities.mobile_phone_numbers
        ); 
    }

    if (authorizedEntities.landline_phone_numbers) {
        authorizedPhoneNumbers = authorizedPhoneNumbers.concat(
            authorizedEntities.landline_phone_numbers
        ); 
    }

    if (oauthAuthorization.user
        && Type.is(oauthAuthorization.user.addresses, Array)
        && oauthAuthorization.user.addresses.length
        // Use can choose only one address to be selected first
        && oauthAuthorization.user.addresses[0]['for'] === 'addresses') {

        addressToBeSelectedFirst = oauthAuthorization.user.addresses[0].address;

        oauthAuthorization.user.addresses = [];
    }

    async.auto({
        insertOauthAuthorization: function (cb) {
            db.models
              .OauthAuthorization
              .create(oauthAuthorization, function (err, oauthAuthorization) {
                if (err) {
                    return cb(err);
                }

                // We don't need to go further 
                // if authorization has been granted to app
                if (oauthAuthorization.hasAppScope()) {
                    authWasGrantedToApp = true;
                }

                cb(null, oauthAuthorization);
            });
        },

        // See `addUserAuthorization`, to learn why we need to find
        // phone numbers type.
        // (`authorizedEntities` contains phone numbers type 
        // that client has asked for not real phone numbers type. 
        // (unknown phone numbers...))
        findAuthorizedPhoneNumberTypes: ['insertOauthAuthorization', function (cb) {
            var phoneNumbers = authorizedPhoneNumbers || [];

            if (authWasGrantedToApp) {
                return cb(null);
            }

            // Always returns array to ease 
            // the process for `addUserAuthorization` action.
            // See below.
            if (!phoneNumbers.length) {
                return cb(null, []);
            }

            db.models
              .PhoneNumber
              .find({
                _id: {
                    $in: phoneNumbers
                }
              })
              .select('phone_type')
              .exec(function (err, phoneNumbers) {
                var phoneNumberTypes = [];

                if (err) {
                    return cb(err);
                }

                phoneNumbers.forEach(function (phoneNumber) {
                    if (phoneNumber.phone_type === 'unknown') {
                        return;
                    }

                    if (phoneNumberTypes.indexOf(phoneNumber.phone_type) === -1) {
                        phoneNumberTypes.push(phoneNumber.phone_type);
                    }
                });

                cb(null, phoneNumberTypes);
            });
        }],

        insertUserStatus: ['insertOauthAuthorization', function (cb, results) {
            var oauthAuthorization = results.insertOauthAuthorization;
            var clientID = oauthAuthorization.issued_to.client;
            var userID = oauthAuthorization.issued_for;

            if (authWasGrantedToApp) {
                return cb(null);
            }

            insertOrUpdateOauthUserStatus(userUseTestAccount, 
                                          oauthAuthorization,
                                          userID, clientID, 
                                          function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        addClientToUser: ['insertUserStatus', function (cb, results) {
            var oauthAuthorization = results.insertOauthAuthorization;

            if (authWasGrantedToApp
                || userUseTestAccount) {
                
                return cb(null);
            }

            // Add client to authorized clients 
            // for current user
            db.models.User.update({
                _id: oauthAuthorization.issued_for
            }, {
                // Use `$addToSet` here not `$push`
                // in order to prevent client._id duplicate
                $addToSet: { 
                    authorized_clients: oauthAuthorization.issued_to.client
                }
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        addUserAuthorization: ['findAuthorizedPhoneNumberTypes', 'addClientToUser', function (cb, results) {
            var oauthAuthorization = results.insertOauthAuthorization;
            var phoneNumberTypes = results.findAuthorizedPhoneNumberTypes;

            var scope = oauthAuthorization.scope;
            var scopeFlags = oauthAuthorization.scope_flags;

            var clientDontWantSpecificPhoneType = scopeFlags.indexOf('mobile_phone_number') === -1 
                                               && scopeFlags.indexOf('landline_phone_number') === -1
                                               && scope.indexOf('phone_numbers') !== -1;

            if (authWasGrantedToApp
                || userUseTestAccount) {
                
                return cb(null);
            }
            
            phoneNumberTypes.forEach(function (phoneNumberType) {
                if (!clientDontWantSpecificPhoneType) {
                    return;
                }

                // User has chosen a mobile phone number 
                // when client ask for phone number without specific type
                // so it has transparently authorized `mobile_phone_number`
                // scope flags
                if (phoneNumberType === 'mobile') {
                    scopeFlags.push('mobile_phone_number');

                    authorizedEntities.mobile_phone_numbers.push(
                        authorizedEntities.unknown_phone_numbers[0]
                    );
                }

                // Same than before but for landline
                if (phoneNumberType === 'landline') {
                    scopeFlags.push('landline_phone_number');

                    authorizedEntities.landline_phone_numbers.push(
                        authorizedEntities.unknown_phone_numbers[0]
                    );
                }
            });

            db.models.UserAuthorization.update({
                user: oauthAuthorization.issued_for,
                client: oauthAuthorization.issued_to.client
            }, {
                // Append missing values
                $addToSet: {
                    scope: {
                        $each: oauthAuthorization.scope
                    },

                    scope_flags: {
                        $each: scopeFlags
                    },

                    'entities.emails': {
                        $each: authorizedEntities.emails || []
                    },

                    'entities.phone_numbers': {
                        $each: authorizedPhoneNumbers || []
                    },

                    'entities.addresses': {
                        $each: authorizedEntities.addresses || []
                    }
                },

                address_to_be_selected_first: addressToBeSelectedFirst
            }, {
                // Whether to create the doc if it doesn't exist
                upsert: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        insertOauthEntitiesID: ['addUserAuthorization', function (cb, results) {
            var oauthAuthorization = results.insertOauthAuthorization;

            var clientID = oauthAuthorization.issued_to.client;
            var userID = oauthAuthorization.issued_for;

            if (authWasGrantedToApp) {
                return cb(null);
            }

            // We must also add an entity ID for the user
            if (!authorizedEntities.users 
                || !authorizedEntities.users.length) {

                authorizedEntities.users = [userID];
            }

            insertOauthEntitiesID(authorizedEntities, userID, 
                                  clientID, function (err) {
        
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        var oauthAuthorization = results && results.insertOauthAuthorization;

        if (err) {
            return cb(err);
        }

        cb(null, oauthAuthorization);
    });
};