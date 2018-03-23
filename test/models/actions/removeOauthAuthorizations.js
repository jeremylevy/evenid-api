var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var removeOauthAuthorizations = require('../../../models/actions/removeOauthAuthorizations');

var createOauthAuthorization = require('../../../testUtils/db/createOauthAuthorization');
var createUser = require('../../../testUtils/db/createUser');
var createOauthAccessToken = require('../../../testUtils/db/createOauthAccessToken');
var createUserAuthorization = require('../../../testUtils/db/createUserAuthorization');
var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');
var createTestAccount = require('../../../testUtils/db/createTestUser');
var createOauthEntityID = require('../../../testUtils/db/createOauthEntityID');

var findOauthAuthorizations = require('../../../testUtils/db/findOauthAuthorizations');
var findUsers = require('../../../testUtils/db/findUsers');
var findOauthAccessTokens = require('../../../testUtils/db/findOauthAccessTokens');
var findUserAuthorizations = require('../../../testUtils/db/findUserAuthorizations');
var findOauthUserStatus = require('../../../testUtils/db/findOauthUserStatus');
var findTestAccounts = require('../../../testUtils/db/findTestUsers');
var findOauthEntitiesID = require('../../../testUtils/db/findOauthEntitiesID');

var createUserForClient = function (clientID, cb) {
    async.auto({
        // We create user to asssert that authorized clients will be updated
        createUser: function (cb) {
            createUser.call({
                user: {
                    password: 'azerty',
                    authorized_clients: [clientID]
                }
            }, function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        },

        // We create user authorization to assert that it will be removed
        createUserAuthorizationForUser: ['createUser', function (cb, results) {
            var user = results.createUser;

            createUserAuthorization.call({
                user: user,
                client: {
                    _id: clientID
                }
            }, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            })
        }],

        // We create user status to assert that it will be removed
        createOauthUserStatusForUser: ['createUser', function (cb, results) {
            var user = results.createUser;
            var useTestAccount = false;

            createOauthUserStatus(clientID, user.id, 'new_user', 
                                  useTestAccount, function (err, oauthUserStatus) {

                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserStatus);
            });
        }],

        // We create test account to assert that it will be removed
        createTestAccountForUser: ['createUser', function (cb, results) {
            var user = results.createUser;
            var useTestAccount = false;

            createTestAccount.call({
                userID : user.id,
                clientID: clientID
            }, function (err, testAccount) {
                if (err) {
                    return cb(err);
                }

                cb(null, testAccount);
            });
        }],

        // We create oauth entity ID to assert that it will be removed
        createOauthEntityIDForUser: ['createUser', function (cb, results) {
            var user = results.createUser;
            var useTestAccount = false;

            createOauthEntityID({
                user: user.id,
                client: clientID,
                real_id: user.id,
                fake_id: mongoose.Types.ObjectId(),
                entities: ['users']
            }, function (err, oauthEntityID) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthEntityID);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null, results.createUser);
    });
};

describe('models.actions.removeOauthAuthorizations', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid oauth authorizations', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthAuthorizations(v, 
                                          mongoose.Types.ObjectId(), 
                                          mongoose.Types.ObjectId(), 
                                          function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid client ID', function () {
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthAuthorizations([mongoose.Types.ObjectId()], 
                                          v, 
                                          mongoose.Types.ObjectId(), 
                                          function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid user ID', function () {
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthAuthorizations([mongoose.Types.ObjectId()], 
                                           mongoose.Types.ObjectId(), 
                                           v, 
                                           function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                removeOauthAuthorizations([mongoose.Types.ObjectId()], 
                                           mongoose.Types.ObjectId(), 
                                           mongoose.Types.ObjectId(), 
                                           v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing client ID without users ID and conversely', function () {
        assert.throws(function () {
            removeOauthAuthorizations([mongoose.Types.ObjectId()], 
                                       mongoose.Types.ObjectId(), 
                                       undefined, 
                                       v);
        }, Error);

        assert.throws(function () {
            removeOauthAuthorizations([mongoose.Types.ObjectId()], 
                                       undefined, 
                                       mongoose.Types.ObjectId(), 
                                       v);
        }, Error);
    });

    it('removes passed authorizations and corresponding access tokens '
       + 'when client and users ID are not set', function (done) {

        async.auto({
            /* First, we create two authorizations */
            createOauthAuthorization: function (cb) {
                createOauthAuthorization(function (err, authorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, authorization);
                });
            },

            createOauthAuthorization2: function (cb) {
                createOauthAuthorization(function (err, authorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, authorization);
                });
            },

            /* And two corresponding access tokens */
            createOauthAccessToken: ['createOauthAuthorization', function (cb, results) {
                var authorization = results.createOauthAuthorization;

                createOauthAccessToken.call({
                    authorizationID: authorization._id
                }, function (err, accessToken) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken);
                });
            }],

            createOauthAccessToken2: ['createOauthAuthorization2', function (cb, results) {
                var authorization = results.createOauthAuthorization2;

                createOauthAccessToken.call({
                    authorizationID: authorization._id
                }, function (err, accessToken) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken);
                });
            }],

            // We remove the two authorizations
            removeOauthAuthorizations: ['createOauthAccessToken', 
                                        'createOauthAccessToken2',
                                        function (cb, results) {

                var authorization = results.createOauthAuthorization;
                var authorization2 = results.createOauthAuthorization2;

                // `null` for client ID and users ID
                removeOauthAuthorizations([authorization._id, authorization2._id], 
                                          null, null, 
                                          function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            // We assert that the two authorizations were removed
            assertAuthorizationsWereRemoved: ['removeOauthAuthorizations', function (cb, results) {
                var authorization = results.createOauthAuthorization;
                var authorization2 = results.createOauthAuthorization2;

                findOauthAuthorizations([authorization._id, authorization2._id], function (err, authorizations) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(authorizations.length, 0);

                    cb();
                });
            }],

            // We assert that the two corresponding access tokens were removed
            assertAccessTokensWereRemoved: ['removeOauthAuthorizations', function (cb, results) {
                var accessToken = results.createOauthAccessToken;
                var accessToken2 = results.createOauthAccessToken2;

                findOauthAccessTokens([accessToken._id, accessToken2._id], function (err, accessTokens) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(accessTokens.length, 0);

                    cb();
                });
            }],
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('removes passed authorizations and corresponding entities '
       + 'when client and users ID are set', function (done) {

        // We don't need to create entire client here
        // `removeOauthAuthorizations` use only the ID
        var clientID = mongoose.Types.ObjectId();

        async.auto({
            // We don't need to create authorization or access token 
            // given that their were tested above

            /* First, we create two users with associated entities */

            createUser: function (cb) {
                createUserForClient(clientID, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            createUser2: function (cb) {
                createUserForClient(clientID, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            /* Then, we remove the associated entities 
               by passing a fake ID as authorization */

            removeOauthAuthorizations: ['createUser', 'createUser2',
                                        function (cb, results) {

                var user = results.createUser;
                var user2 = results.createUser2;

                removeOauthAuthorizations([mongoose.Types.ObjectId()], 
                                          clientID, 
                                          [user.id, user2.id], 
                                          function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // We assert that user authorized clients were updated
            assertUserAuthorizedClientsWereUpdated: ['removeOauthAuthorizations', 
                                                     function (cb, results) {
                
                var user = results.createUser;
                var user2 = results.createUser2;

                findUsers([user.id, user2.id], function (err, users) {
                    if (err) {
                        return cb(err);
                    }

                    // Two users
                    assert.strictEqual(users.length, 2);

                    users.forEach(function (user) {
                        assert.strictEqual(user.authorized_clients.length, 0);
                    });

                    cb();
                })
            }],

            // We assert that user authorizations were removed
            assertUserAuthorizationWasRemoved: ['removeOauthAuthorizations', 
                                                function (cb, results) {
                
                var user = results.createUser;
                var user2 = results.createUser2;

                findUserAuthorizations([user.id, user2.id], function (err, userAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(userAuthorizations.length, 0);

                    cb();
                });
            }],

            // We assert that user status were removed
            assertOauthUserStatusWasRemoved: ['removeOauthAuthorizations', 
                                              function (cb, results) {
                
                var user = results.createUser;
                var user2 = results.createUser2;

                findOauthUserStatus(clientID, [user.id, user2.id], function (err, oauthUserStatus) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserStatus.length, 0);

                    cb();
                });
            }],

            // We assert that test accounts were removed
            assertTestAccountWasRemoved: ['removeOauthAuthorizations', 
                                          function (cb, results) {
                
                var user = results.createUser;
                var user2 = results.createUser2;

                findTestAccounts(clientID, [user.id, user2.id], function (err, testAccounts) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(testAccounts.length, 0);

                    cb();
                });
            }],

            // We assert that oauth entities ID were removed
            assertOauthEntityIDWasRemoved: ['removeOauthAuthorizations', 
                                            function (cb, results) {
                
                var user = results.createUser;
                var user2 = results.createUser2;

                findOauthEntitiesID({
                    user: {
                        $in: [user.id, user2.id]
                    },
                    client: clientID
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesID.length, 0);

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
});