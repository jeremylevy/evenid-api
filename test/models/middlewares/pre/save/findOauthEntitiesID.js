var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');

var findOauthEntitiesID = require('../../../../../models/middlewares/pre/save/findOauthEntitiesID');

var createAddress = require('../../../../../testUtils/db/createAddress');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var createUser = require('../../../../../testUtils/db/createUser');
var createOauthClient = require('../../../../../testUtils/db/createOauthClient');

var createOauthEntityID = require('../../../../../testUtils/db/createOauthEntityID');

var createEntityID = function (userID, clientID, realID, entities, cb) {
    createOauthEntityID({
        client: clientID,
        user: userID,
        fake_id: mongoose.Types.ObjectId(),
        real_id: realID,
        entities: entities,
        use_test_account: false
    }, function (err, oauthEntityID) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthEntityID);
    });
};

describe('models.middlewares.pre.save.findOauthEntitiesID', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing invalid entity name', function () {
        [null, undefined, {}, [], 'fooz', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid event name', function () {
        // Needs non-false value
        [{}, [], 'foo', function () {}].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID.call({
                    eventName: v
                }, 'users');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID('addresses').call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function () {
        [null, undefined, {}, [], '', 0.0].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID('addresses').call({
                    _id: mongoose.Types.ObjectId()
                }, v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-user '
       + 'entity without user property', function (done) {
        
        createAddress(function (err, address) {
            if (err) {
                return done(err);
            }

            address.user = undefined;

            assert.throws(function () {
                findOauthEntitiesID('addresses').call(address, function () {

                });
            }, assert.AssertionError);

            done();
        });
    });

    it('throws an exception when passing entity '
       + 'without `_granted_authorizations` property', function (done) {
        
        createAddress(function (err, address) {
            if (err) {
                return done(err);
            }

            address.user = mongoose.Types.ObjectId();

            assert.throws(function () {
                findOauthEntitiesID('addresses').call(address, function () {

                });
            }, assert.AssertionError);

            done();
        });
    });

    it('populates `_oauth_entities_id` for '
       + 'passed `_granted_authorizations` clients '
       + 'which handle update notifications', function (done) {

        async.auto({
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, user);
                });
            },

            // One client which must be used
            // given that it handle update notifications
            createOauthClient: function (cb) {
                createOauthClient.call({
                    update_notification_handler: 'http://bar.com'
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, client);
                });
            },

            // Another which must not
            createOauthClient2: function (cb) {
                createOauthClient.call({
                    update_notification_handler: undefined
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, client);
                });
            },

            // One entity for the first client
            createEntityID: ['createUser',
                             'createOauthClient',
                             function (cb, results) {

                var user = results.createUser;
                var client = results.createOauthClient;

                createEntityID(user.id, client.id, 
                               user.id, ['users'],
                               function (err, oauthEntityID) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

            // One entity for the second
            createEntityID2: ['createUser',
                              'createOauthClient2',
                              function (cb, results) {

                var user = results.createUser;
                var client = results.createOauthClient2;

                createEntityID(user.id, client.id, 
                               user.id, ['users'],
                               function (err, oauthEntityID) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

            // Make sure only client entities ID
            // for THIS USER are populated.
            // Added after a bug.
            createEntityIDForOtherUser: ['createUser',
                                         'createOauthClient',
                                         function (cb, results) {

                var user = results.createUser;
                var client = results.createOauthClient;

                createEntityID(mongoose.Types.ObjectId(),
                               client.id, 
                               user.id, ['users'],
                               function (err, oauthEntityID) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

            createUserAuthorization: ['createUser',
                                      'createOauthClient',
                                      function (cb, results) {
                
                var user = results.createUser;
                var client = results.createOauthClient;

                createUserAuthorization.call({
                    user: user,
                    client: client
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs 
                    // populated client
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            // Also, assert it doesn't populate 
            // if we have no modified field
            findOauthEntitiesID: ['createUserAuthorization',
                                  'createEntityID',
                                  'createEntityID2',
                                  'createEntityIDForOtherUser',
                                  function (cb, results) {
                
                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;

                user._granted_authorizations = [
                    userAuthorization
                ];

                // Assert it doesn't populate 
                // if we have no modified field
                findOauthEntitiesID('users').call(user, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    assert.ok(Type.is(user._oauth_entities_id, Array));
                    assert.strictEqual(user._oauth_entities_id.length, 0);

                    // We modify the user
                    user.first_name = mongoose.Types.ObjectId().toString();

                    findOauthEntitiesID('users').call(user, function (err) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, user._oauth_entities_id);
                    });
                });
            }],

            assertItHasPopulatedEntitiesID: ['findOauthEntitiesID',
                                             function (cb, results) {

                var oauthEntitiesID = results.findOauthEntitiesID;
                var oauthEntityID = results.createEntityID;
                
                // Make sure only the entity 
                // for the first client 
                // (which handle update notification)
                // and for the first created user was returned.
                assert.strictEqual(oauthEntitiesID.length, 1);

                assert.strictEqual(oauthEntitiesID[0].id,
                                   oauthEntityID.id);
                
                cb();
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('populates `_oauth_entities_id` for removed entity with '
       + 'passed `_granted_authorizations` clients '
       + 'which handle update notifications', function (done) {

        async.auto({
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, user);
                });
            },

            // One client which must be used
            // given that it handle update notifications
            createOauthClient: function (cb) {
                createOauthClient.call({
                    update_notification_handler: 'http://bar.com'
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, client);
                });
            },

            // One entity for the first client
            createEntityID: ['createUser',
                             'createOauthClient',
                             function (cb, results) {

                var user = results.createUser;
                var client = results.createOauthClient;

                createEntityID(user.id, client.id, 
                               user.id, ['users'],
                               function (err, oauthEntityID) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

            createUserAuthorization: ['createUser',
                                      'createOauthClient',
                                      function (cb, results) {
                
                var user = results.createUser;
                var client = results.createOauthClient;

                createUserAuthorization.call({
                    user: user,
                    client: client
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs 
                    // populated client
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            findOauthEntitiesID: ['createUserAuthorization',
                                  'createEntityID',
                                  function (cb, results) {
                
                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;

                user._granted_authorizations = [
                    userAuthorization
                ];

                // Make sure it populates
                // even if we don't have 
                // modified field
                findOauthEntitiesID.call({
                    eventName: 'remove'
                }, 'users').call(user, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user._oauth_entities_id);
                });
            }],

            assertItHasPopulatedEntitiesID: ['findOauthEntitiesID',
                                             function (cb, results) {

                var oauthEntitiesID = results.findOauthEntitiesID;
                var oauthEntityID = results.createEntityID;
                
                // Make sure it works
                assert.strictEqual(oauthEntitiesID.length, 1);

                assert.strictEqual(oauthEntitiesID[0].id,
                                   oauthEntityID.id);
                
                cb();
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});