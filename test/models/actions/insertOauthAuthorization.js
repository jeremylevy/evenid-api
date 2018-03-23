var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../config');

var db = require('../../../models');

var insertOauthAuthorization = require('../../../models/actions/insertOauthAuthorization');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var compareArray = require('../../../testUtils/lib/compareArray');

var findUserAuthorizations = require('../../../testUtils/db/findUserAuthorizations');
var findUsers = require('../../../testUtils/db/findUsers');

var findOauthUserStatus = require('../../../testUtils/db/findOauthUserStatus');
var findOauthEntitiesID = require('../../../testUtils/db/findOauthEntitiesID');

var findOauthAuthorizations = require('../../../testUtils/db/findOauthAuthorizations');

var createUser = require('../../../testUtils/db/createUser');
var createOauthClient = require('../../../testUtils/db/createOauthClient');

var createPhoneNumber = require('../../../testUtils/db/createPhoneNumber');

describe('models.actions.insertOauthAuthorization', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing '
       + 'non-boolean value for `userUseTestAccount`', function () {
        
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthAuthorization(v, {}, {
                    _id: mongoose.Types.ObjectId()
                }, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-object value as `authorizedEntities`', function () {
        
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthAuthorization(true, v, {
                    _id: mongoose.Types.ObjectId()
                }, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid authorization', function () {
        
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthAuthorization(false, {}, v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                insertOauthAuthorization(false, {}, {
                    _id: mongoose.Types.ObjectId()
                }, v);
            }, assert.AssertionError);
        });
    });

    it('returns app oauth authorization '
       + 'when valid values were passed', function (done) {
        
        async.auto({
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            insertOauthAuthorization: ['createUser', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var user = results.createUser;
                var emailID = mongoose.Types.ObjectId();
                var addressID = mongoose.Types.ObjectId();
                var phoneNumberID = mongoose.Types.ObjectId();
                var authorizedEntities = {
                    emails: [emailID],
                    unknown_phone_numbers: [phoneNumberID],
                    addresses: [addressID]
                };
                var insertedOauthAuthorization = {
                    issued_for: user.id,
                    type: 'token',
                    scope: ['app'],
                    user: {
                        addresses: [{
                            address: addressID,
                            for: 'billing'
                        }]
                    }
                };

                insertOauthAuthorization(false, authorizedEntities, 
                                         insertedOauthAuthorization,
                                         function (err, oauthAuthorization) {
                    
                    if (err) {
                        return cb(err);
                    }

                    /* Make sure oauth authorization was inserted in DB */
                    assert.ok(areValidObjectIDs([oauthAuthorization._id]));

                    cb(null, {
                        oauthAuthorization: insertedOauthAuthorization,
                        authorizedEntities: authorizedEntities
                    });
                });
            }],

            // Make sure app was not added 
            // to user's `authorized_clients` field
            assertClientWasNotAddedToUserAuthorizedClients: ['insertOauthAuthorization', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var user = results.createUser;

                findUsers([user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);
                    assert.ok(compareArray(user.authorized_clients, []));

                    cb();
                });
            }],

            assertOauthEntitiesIDWereNotInserted: ['insertOauthAuthorization', function (cb, results) {
                var user = results.createUser;
                var insertOauthAuthorizationResp = results.insertOauthAuthorization;

                var authorizedEntities = insertOauthAuthorizationResp.authorizedEntities;
                var authorizedEntitiesID = [];

                Object.keys(authorizedEntities).forEach(function (entityName) {
                    authorizedEntitiesID = authorizedEntitiesID.concat(authorizedEntities[entityName]);
                });

                findOauthEntitiesID({
                    user: user.id,
                    real_id: {
                        $in: authorizedEntitiesID
                    }
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesID.length, 0);

                    cb(null);
                });
            }],

            // Make sure after inserting to `OauthAuthorization`
            // client was not added to `UserAuthorizations
            assertUserAuthWasNotCreated: ['insertOauthAuthorization', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var oauthAuthorization = results.insertOauthAuthorization.oauthAuthorization;
                var user = results.createUser;

                findUserAuthorizations(user.id, function (err, userAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(userAuthorizations.length, 0);

                    cb(null);
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('returns client oauth authorization when '
       + 'valid values were passed for user '
       + 'or test user', function (done) {
        
        var testWhen = function (testAccountWasUsed, done) {
            async.auto({
                createOauthClient: function (cb) {
                    createOauthClient(function (err, oauthClient) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, oauthClient);
                    });
                },

                createUser: function (cb) {
                    createUser(function (err, user) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, user);
                    });
                },

                insertOauthAuthorization: ['createOauthClient', 'createUser', function (cb, results) {
                    var oauthClient = results.createOauthClient;
                    var user = results.createUser;
                    var emailID = mongoose.Types.ObjectId();
                    var addressID = mongoose.Types.ObjectId();
                    var phoneNumberID = mongoose.Types.ObjectId();
                    var authorizedEntities = {
                        users: [user.id],
                        // Even if we known that test account entities 
                        // (different of users) are inserted when getting user
                        // we test for it to avoid doing different assert
                        // than when test account is not used
                        emails: [emailID],
                        unknown_phone_numbers: [phoneNumberID],
                        addresses: [addressID],
                        use_test_account: !!testAccountWasUsed
                    };
                    var insertedOauthAuthorization = {
                        issued_for: user.id,
                        issued_to: {
                            client: oauthClient.id
                        },
                        type: 'token',
                        scope: ['emails', 'first_name', 
                                'last_name', 'addresses', 
                                'phone_numbers'],
                        user: {
                            addresses: [{
                                address: addressID,
                                for: 'billing'
                            }]
                        }
                    };

                    insertOauthAuthorization(!!testAccountWasUsed, authorizedEntities, 
                                             insertedOauthAuthorization, function (err, oauthAuthorization) {
                        
                        if (err) {
                            return cb(err);
                        }

                        /* Make sure oauth authorization was inserted in DB */
                        assert.ok(areValidObjectIDs([oauthAuthorization._id]));

                        // Ease the process when asserting 
                        // that oauth entities ID were created
                        delete authorizedEntities.use_test_account;

                        cb(null, {
                            oauthAuthorization: insertedOauthAuthorization,
                            authorizedEntities: authorizedEntities
                        });
                    });
                }],

                // Make sure user status was inserted.
                // Don't check for duplicates. 
                // Already checked when testing for 
                // `insertOrUpdateOauthUserStatus` function.
                assertUserStatusWasInserted: ['insertOauthAuthorization', function (cb, results) {
                    var client = results.createOauthClient;
                    var user = results.createUser;

                    findOauthUserStatus(client.id, user.id, function (err, oauthUserStatus) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthUserStatus.client.toString(),
                                           client.id.toString());

                        assert.strictEqual(oauthUserStatus.user.toString(),
                                           user.id.toString());

                        assert.strictEqual(oauthUserStatus.status, 'new_user');

                        assert.strictEqual(oauthUserStatus.use_test_account, !!testAccountWasUsed);

                        cb();
                    });
                }],

                // Make sure client was added to user's `authorized_clients` field
                assertClientWasAddedToUserAuthorizedClients: ['insertOauthAuthorization', function (cb, results) {
                    var oauthClient = results.createOauthClient;
                    var user = results.createUser;

                    findUsers([user.id], function (err, users) {
                        var user = users[0];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(users.length, 1);
                        assert.ok(compareArray(user.authorized_clients, 
                                               testAccountWasUsed ? [] : [oauthClient.id]));

                        cb();
                    });
                }],

                assertOauthEntitiesIDWereInserted: ['insertOauthAuthorization', function (cb, results) {
                    var client = results.createOauthClient;
                    var user = results.createUser;
                    var insertOauthAuthorizationResp = results.insertOauthAuthorization;

                    var authorizedEntities = insertOauthAuthorizationResp.authorizedEntities;
                    var authorizedEntitiesID = [];

                    Object.keys(authorizedEntities).forEach(function (entityName) {
                        authorizedEntitiesID = authorizedEntitiesID.concat(authorizedEntities[entityName]);
                    });

                    findOauthEntitiesID({
                        client: client.id,
                        user: user.id,
                        real_id: {
                            $in: authorizedEntitiesID
                        },
                        use_test_account: !!testAccountWasUsed
                    }, function (err, oauthEntitiesID) {
                        var foundEntities = {};

                        if (err) {
                            return cb(err);
                        }

                        oauthEntitiesID.forEach(function (oauthEntityID) {
                            var entities = oauthEntityID.entities;

                            entities.forEach(function (entity) {
                                if (!foundEntities[entity]) {
                                    foundEntities[entity] = [];
                                }

                                foundEntities[entity].push(oauthEntityID.real_id);
                            });
                        });

                        Object.keys(authorizedEntities).forEach(function (entityName) {
                            assert.ok(compareArray(authorizedEntities[entityName],
                                                   foundEntities[entityName]));
                        });

                        cb(null, oauthEntitiesID);
                    });
                }],

                // Make sure after inserting to `OauthAuthorization`
                // client was added to `UserAuthorizations
                assertUserAuthWasCreated: ['insertOauthAuthorization', function (cb, results) {
                    var oauthClient = results.createOauthClient;
                    var oauthAuthorization = results.insertOauthAuthorization.oauthAuthorization;
                    var user = results.createUser;

                    findUserAuthorizations(user.id, function (err, userAuthorizations) {
                        var userAuthorization = null;
                        var userAuthorizationEntities = null;
                        var addresses = [];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(userAuthorizations.length, testAccountWasUsed ? 0 : 1);

                        if (testAccountWasUsed) {
                            return cb(null, userAuthorizations);
                        }

                        userAuthorization = userAuthorizations[0];
                        userAuthorizationEntities = userAuthorization.entities;

                        assert.strictEqual(userAuthorization.client.toString(), oauthClient.id);
                        assert.strictEqual(userAuthorization.user.toString(), user.id);

                        // `toObject()`: Returns a native js Array.
                        assert.ok(compareArray(userAuthorization.scope.toObject(),
                                               oauthAuthorization.scope));

                        assert.ok(userAuthorizationEntities.emails.length > 0);
                        assert.ok(userAuthorizationEntities.phone_numbers.length > 0);

                        // `addressObj` equals: {address: ID, for: [billing|shipping|unknown]}
                        addresses = oauthAuthorization.user.addresses.map(function (addressObj) {
                            return addressObj.address;
                        });

                        assert.ok(compareArray(userAuthorizationEntities.addresses.toObject(),
                                               addresses));

                        cb(null, userAuthorizations);
                    });
                }],

                // Insert exactly the same oauth authorization than above 
                // in order to check for duplicates in user authorization entities and scope
                assertUserAuthInsertPreventDuplicates: ['assertUserAuthWasCreated', function (cb, results) {
                    var authorizedEntities = results.insertOauthAuthorization.authorizedEntities;
                    var insertedOauthAuthorization = results.insertOauthAuthorization.oauthAuthorization;

                    insertOauthAuthorization(!!testAccountWasUsed, authorizedEntities, 
                                             insertedOauthAuthorization, function (err, oauthAuthorization) {
                        
                        if (err) {
                            return cb(err);
                        }

                        findUserAuthorizations(oauthAuthorization.issued_for, function (err, userAuthorizations) {
                            var userAuthorization = null;
                            var userAuthorizationEntities = null;
                            var addresses = [];

                            if (err) {
                                return cb(err);
                            }

                            assert.strictEqual(userAuthorizations.length, testAccountWasUsed ? 0 : 1);

                            if (testAccountWasUsed) {
                                return cb(null, userAuthorizations);
                            }

                            userAuthorization = userAuthorizations[0];
                            userAuthorizationEntities = userAuthorization.entities;

                            assert.ok(compareArray(userAuthorization.scope.toObject(),
                                                   insertedOauthAuthorization.scope));

                            assert.ok(compareArray(userAuthorizationEntities.emails.toObject(), 
                                                   authorizedEntities.emails));

                            assert.ok(compareArray(userAuthorizationEntities.phone_numbers.toObject(), 
                                                   authorizedEntities.unknown_phone_numbers));

                            // `addressObj` equals: {address: ID, for: [billing|shipping|unknown]}
                            addresses = insertedOauthAuthorization.user.addresses.map(function (addressObj) {
                                return addressObj.address;
                            });

                            assert.ok(compareArray(userAuthorizationEntities.addresses.toObject(),
                                                   addresses));

                            cb(null, userAuthorizations);
                        });
                    });
                }]
            }, function (err, results) {
                if (err) {
                    return done(err);
                }

                done();
            });
        };

        // Use test account ?
        testWhen(true, function (err) {
            if (err) {
                return done(err);
            }

            testWhen(false, done);
        });
    });
    
    // User has chosen a mobile/landline phone number 
    // when client ask for phone number without specific type
    // so it has transparently authorized `mobile_phone_number`
    // or `landline_phone_number` scope flags
    it('adds phone number scope flags when client ask '
       + 'for phone number whose type doesn\'t matter', function (done) {
        
        async.auto({
            createOauthClient: function (cb) {
                createOauthClient(function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            },

            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            createMobilePhoneNumber: ['createUser', function (cb, results) {
                var user = results.createUser;

                createPhoneNumber.call({
                    number: '0638749389',
                    country: 'FR',
                    user: user.id
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

            createLandlinePhoneNumber: ['createUser', function (cb, results) {
                var user = results.createUser;

                createPhoneNumber.call({
                    number: '0491749389',
                    country: 'FR',
                    user: user.id
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

            insertOauthAuthorization: ['createOauthClient', 'createMobilePhoneNumber', 
                                       'createLandlinePhoneNumber', function (cb, results) {
                
                var oauthClient = results.createOauthClient;
                var user = results.createUser;

                var mobilePhoneNumber = results.createMobilePhoneNumber;
                var landlinePhoneNumber = results.createLandlinePhoneNumber;

                var userUseTestAccount = false;

                var authorizedEntities = {
                    unknown_phone_numbers: [mobilePhoneNumber.id],
                    mobile_phone_numbers: [],
                    landline_phone_numbers: []
                };
                var insertedOauthAuthorization = {
                    issued_for: user.id,
                    issued_to: {
                        client: oauthClient.id
                    },
                    type: 'token',
                    scope: ['phone_numbers'],
                    // Make sure we have no phone number scope flags
                    scope_flags: []
                };

                insertOauthAuthorization(userUseTestAccount, authorizedEntities, 
                                         insertedOauthAuthorization, 
                                         function (err, oauthAuthorization) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthAuthorization);
                });
            }],

            assertPhoneScopeFlagsWereSet: ['insertOauthAuthorization', function (cb, results) {
                var oauthAuthorization = results.insertOauthAuthorization;

                findUserAuthorizations(oauthAuthorization.issued_for, 
                                       function (err, userAuthorizations) {
                    
                    var userAuthorization = !err && userAuthorizations[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.ok(userAuthorization.scope_flags
                                               .indexOf('mobile_phone_number') !== -1);
                    
                    assert.ok(userAuthorization.scope_flags
                                               .indexOf('landline_phone_number') === -1);

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('sets "non-separated addresses '
       + 'for" to user authorization', function (done) {

        var addressID = mongoose.Types.ObjectId();
        
        async.auto({
            createOauthClient: function (cb) {
                createOauthClient(function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            },

            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            insertOauthAuthorization: ['createOauthClient', 
                                       'createUser', function (cb, results) {
                
                var oauthClient = results.createOauthClient;
                var user = results.createUser;

                var userUseTestAccount = false;

                var authorizedEntities = {
                    addresses: [addressID]
                };
                var insertedOauthAuthorization = {
                    issued_for: user.id,
                    issued_to: {
                        client: oauthClient.id
                    },
                    type: 'token',
                    scope: ['addresses'],
                    user: {
                        addresses: [{
                            address: addressID,
                            for: 'addresses'
                        }]
                    }
                };

                insertOauthAuthorization(userUseTestAccount,authorizedEntities, 
                                         insertedOauthAuthorization,
                                         function (err, oauthAuthorization) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthAuthorization);
                });
            }],

            assertAddressForWasNotSetToOauthAuth: ['insertOauthAuthorization', function (cb, results) {
                var oauthAuthorization = results.insertOauthAuthorization;

                findOauthAuthorizations([oauthAuthorization.id], function (err, oauthAuthorizations) {
                    var oauthAuthorization = oauthAuthorizations && oauthAuthorizations[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthAuthorizations.length, 1);

                    assert.deepEqual(oauthAuthorization.user.addresses.toObject(), []);

                    cb(null);
                });
            }],  

            assertAddressForWasSetToUserAuth: ['insertOauthAuthorization', function (cb, results) {
                var oauthAuthorization = results.insertOauthAuthorization;
                var user = results.createUser;

                findUserAuthorizations(user.id, function (err, userAuthorizations) {
                    var userAuthorization = userAuthorizations && userAuthorizations[0];
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(userAuthorizations.length, 1);

                    assert.strictEqual(userAuthorization.address_to_be_selected_first
                                                        .toString(),
                                       addressID.toString());

                    cb(null);
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});