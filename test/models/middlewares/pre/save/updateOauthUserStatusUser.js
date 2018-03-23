var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var updateOauthUserStatus = require('../../../../../models/middlewares/pre/save/updateOauthUserStatus');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var createUser = require('../../../../../testUtils/db/createUser');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var createClient = require('../../../../../testUtils/db/createOauthClient');
var createOauthUserStatus = require('../../../../../testUtils/db/createOauthUserStatus');

var findOauthUserStatus = require('../../../../../testUtils/db/findOauthUserStatus');

describe('models.middlewares.pre.save.updateOauthUserStatus (Users)', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('updates oauth user status for clients '
       + 'which have asked for updated fields', function (done) {
        
        async.auto({
            // We create one user
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            // Two clients which must be notified
            createClient: function (cb) {
                createClient(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            createClient2: function (cb) {
                createClient(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            // We authorize the first client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    scope: ['emails', 'first_name', 'nickname', 'addresses']
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs populated client
                    userAuthorization = userAuthorization.toObject();
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            // We authorize the second client
            createUserAuthorization2: ['createUser', 'createClient2', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient2;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    scope: ['phone_numbers', 'first_name',
                            'nationality', 'timezone']
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs populated client
                    userAuthorization = userAuthorization.toObject();
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            // We create user status for the first client
            createOauthUserStatus: ['createUserAuthorization', function (cb, results) {
                var userAuthorization = results.createUserAuthorization;
                var useTestAccount = false;

                createOauthUserStatus(userAuthorization.client.id, 
                                      userAuthorization.user, 
                                      'existing_user', useTestAccount, 
                                      function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            }],

            // We create user status for the second client
            createOauthUserStatus2: ['createUserAuthorization2', function (cb, results) {
                var userAuthorization = results.createUserAuthorization2;
                var useTestAccount = false;

                createOauthUserStatus(userAuthorization.client.id,
                                      userAuthorization.user, 
                                      'existing_user', useTestAccount, 
                                      function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            }],

            // We update the user
            updateUser: ['createOauthUserStatus', 
                         'createOauthUserStatus2', 
                         function (cb, results) {

                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                // Update fields that match authorized scope for the two clients
                user.first_name = mongoose.Types.ObjectId().toString();
                user.nickname = mongoose.Types.ObjectId().toString();
                
                user.nationality = 'UK';
                user.timezone = 'Europe/Dublin';

                // Update fields that clients cannot ask for 
                // to ensure that they will not be notified 
                // of this field update
                user.password = 'foobar';

                user._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                updateOauthUserStatus('users').call(user, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // We assert that the two user status 
            // were updated accordingly to authorized scope
            assertItHasUpdatedUserStatus: ['updateUser', function (cb, results) {
                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                findOauthUserStatus([userAuthorization.client.id, 
                                     userAuthorization2.client.id], 
                                     [user.id], function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    // Make sure we have the status for the two clients
                    assert.strictEqual(oauthUserStatus.length, 2);

                    oauthUserStatus.forEach(function (userStatus) {
                        // Make sure status was updated for the two clients
                        assert.strictEqual(userStatus.status, 'existing_user_after_update');

                        // In order to ease the updated process
                        // `updated_fields` field contains ALL updated field not only the one 
                        // wanted by client. 
                        assert.ok(compareArray(
                            userStatus.updated_fields,
                            ['first_name', 'nickname', 
                             'nationality', 'timezone']
                        ));
                    });

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
    
    it('doesn\'t update oauth user status for clients '
       + 'which doesn\'t have asked for updated fields '
       + 'or handle update notifications', function (done) {
        
        async.auto({
            // We create one user
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            // One client which doesn't 
            // have asked for updated fields
            createClient: function (cb) {
                createClient(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            // And one client which handle update notificatons
            createClient2: function (cb) {
                createClient.call({
                    update_notification_handler: 'http://bar.com'
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            // We authorize the first client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    // Make sure this were fields 
                    // that the user will not update
                    scope: ['last_name', 'gender']
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs populated client
                    userAuthorization = userAuthorization.toObject();
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            // We authorize the second
            createUserAuthorization2: ['createUser', 'createClient2', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient2;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    // Make sure this were fields 
                    // that the user will update
                    scope: ['first_name', 'nickname']
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs populated client
                    userAuthorization = userAuthorization.toObject();
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            // We create user status for the first client
            createOauthUserStatus: ['createUserAuthorization', function (cb, results) {
                var userAuthorization = results.createUserAuthorization;
                var useTestAccount = false;

                createOauthUserStatus(userAuthorization.client.id, 
                                      userAuthorization.user, 
                                      'existing_user', useTestAccount, 
                                      function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            }],

            // and the second
            createOauthUserStatus2: ['createUserAuthorization2', function (cb, results) {
                var userAuthorization = results.createUserAuthorization2;
                var useTestAccount = false;

                createOauthUserStatus(userAuthorization.client.id, 
                                      userAuthorization.user, 
                                      'existing_user', useTestAccount, 
                                      function (err, userStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });
            }],

            // We update the user
            updateUser: ['createOauthUserStatus',
                         'createOauthUserStatus2',
                         function (cb, results) {

                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                // Update fields that doesn't match 
                // authorized scope for first client 
                // but match for second
                user.first_name = mongoose.Types.ObjectId().toString();
                user.nickname = mongoose.Types.ObjectId().toString();
                
                user.nationality = 'UK';
                user.timezone = 'Europe/Dublin';

                user._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                updateOauthUserStatus('users').call(user, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // We assert it has not updated the user status
            assertItHasNotUpdatedUserStatus: ['updateUser', function (cb, results) {
                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                findOauthUserStatus([userAuthorization.client.id,
                                     userAuthorization2.client.id], 
                                    [user.id], function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    // Make sure we have the status for the two clients
                    assert.strictEqual(oauthUserStatus.length, 2);

                    oauthUserStatus.forEach(function (userStatus) {
                        /* Make sure status was not updated */

                        assert.strictEqual(userStatus.status, 'existing_user');

                        assert.ok(compareArray(
                            userStatus.updated_fields,
                            []
                        ));
                    });

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