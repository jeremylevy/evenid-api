var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');

var sendNotificationToClients = require('../../../../../models/middlewares/pre/save/sendNotificationToClients');

var createUser = require('../../../../../testUtils/db/createUser');
var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var createClient = require('../../../../../testUtils/db/createOauthClient');
var createOauthEntityID = require('../../../../../testUtils/db/createOauthEntityID');

var findOauthNotifications = require('../../../../../testUtils/db/findOauthNotifications');
var findLastOauthNotification = require('../../../../../testUtils/db/findLastOauthNotification');

var compareArray = require('../../../../../testUtils/lib/compareArray');

describe('models.middlewares.pre.save.'
         + 'sendNotificationToClients (Users)', function () {
    
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('notifies client which '
      + 'have asked for updated fields', function (done) {
        
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
                createClient.call({
                    update_notification_handler: 'http://bar.com'
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            createClient2: function (cb) {
                createClient.call({
                    update_notification_handler: 'http://bar2.com'
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            createEntityIDForUser: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createOauthEntityID({
                    client: client.id,
                    user: user.id,
                    fake_id: mongoose.Types.ObjectId(),
                    real_id: user.id,
                    entities: ['users'],
                    use_test_account: false
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

            createEntityIDForUser2: ['createUser', 'createClient2', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient2;

                createOauthEntityID({
                    client: client.id,
                    user: user.id,
                    fake_id: mongoose.Types.ObjectId(),
                    real_id: user.id,
                    entities: ['users'],
                    use_test_account: false
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

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

            // We update the user
            updateUser: ['createEntityIDForUser',
                         'createEntityIDForUser2',
                         'createUserAuthorization', 
                         'createUserAuthorization2', 
                         function (cb, results) {

                var user = results.createUser;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                // Update fields that match 
                // authorized scope for the two clients
                user.first_name = mongoose.Types.ObjectId().toString();
                user.nickname = mongoose.Types.ObjectId().toString();

                user.nationality = 'US';
                user.timezone = 'Europe/Dublin';

                // Update fields that clients cannot ask for 
                // to ensure that they will not be notified 
                // of this field update
                user.password = 'foobar';

                // Update fields that 
                // clients doesn't want
                // to ensure that they will not be notified 
                // of this field update
                user.last_name = mongoose.Types.ObjectId().toString();

                user._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                user._oauth_entities_id = [
                    entityIDForUser,
                    entityIDForUser2
                ];

                sendNotificationToClients('users').call(user, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            assertItHasUpdatedOauthNotifications: ['updateUser', function (cb, results) {
                var updatedUser = results.updateUser;

                var client = results.createClient;
                var client2 = results.createClient2;

                var user = results.createUser;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                findOauthNotifications([client.id, client2.id],
                                       [entityIDForUser.fake_id, entityIDForUser2.fake_id],
                                       function (err, oauthNotifications) {

                    var notificationForClients = [];
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthNotifications.length, 2);

                    oauthNotifications.forEach(function (oauthNotification) {
                        var pendingNotification = oauthNotification.pending_notifications[0];
                        
                        var notificationObj = pendingNotification && JSON.parse(pendingNotification.notification);
                        var notification = notificationObj && notificationObj.notification;

                        var wantedClient = client;
                        var notification = notificationObj.notification;

                        if (notificationObj.client_secret !== client.client_secret.toString()) {
                            wantedClient = client2;

                            notificationForClients.push(client2);
                        } else {
                            notificationForClients.push(client);
                        }

                        assert.strictEqual(notificationObj.client_secret,
                                           wantedClient.client_secret);

                        assert.strictEqual(notificationObj.handler_url,
                                           wantedClient.update_notification_handler);

                        assert.strictEqual(notification.event_type,
                                           'user_did_update_personal_information');

                        if (wantedClient === client2) {
                            assert.strictEqual(notification.user_id,
                                               entityIDForUser2.fake_id.toString());

                            assert.ok(compareArray(notification.updated_fields,
                                      ['first_name', 'nationality', 'timezone']));

                            assert.strictEqual(notification.first_name,
                                               updatedUser.first_name);

                            assert.strictEqual(notification.nationality,
                                               updatedUser.nationality);

                            assert.strictEqual(notification.timezone,
                                               updatedUser.timezone);
                        } else {
                            assert.strictEqual(notification.user_id,
                                               entityIDForUser.fake_id.toString());
                            
                            assert.ok(compareArray(notification.updated_fields,
                                      ['first_name', 'nickname']));

                            assert.strictEqual(notification.first_name,
                                               updatedUser.first_name);

                            assert.strictEqual(notification.nickname,
                                               updatedUser.nickname);
                        }
                    });

                    // Make sure the oauth user statues contain
                    // the notifications for the TWO clients
                    assert.strictEqual(notificationForClients.length, 2);

                    cb(null);
                });
            }],

            // We assert that the Oauth 
            // notification was set in SQS
            assertItHasSetOauthNotifInSQS: ['updateUser', function (cb, results) {
                var client = results.createClient;
                var client2 = results.createClient2;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                findLastOauthNotification(function (err, oauthNotification) {
                    var notifications = [];
                    var notificationForClients = [];

                    if (err) {
                        return cb(err);
                    }

                    assert.ok(!!oauthNotification);

                    notifications = JSON.parse(oauthNotification.payload);

                    assert.strictEqual(notifications.length, 2);

                    notifications.forEach(function (notificationObj) {
                        assert.deepEqual(notificationObj, {
                            client_id: notificationObj.client_id === client.id 
                                ? client.id 
                                : client2.id,
                            user_id: notificationObj.client_id === client.id 
                                ? entityIDForUser.fake_id.toString() 
                                : entityIDForUser2.fake_id.toString()
                        });

                        if (notificationObj.client_secret !== client.client_secret) {
                            notificationForClients.push(client2);
                        } else {
                            notificationForClients.push(client);
                        }
                    });
                    
                    // Make sure the oauth notification contains
                    // the notifications for the TWO clients
                    assert.strictEqual(notificationForClients.length, 2);

                    cb(null, oauthNotification);
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('doesn\'t notify clients which doesn\'t have '
       + 'asked for updated fields or doesn\'t handle '
       + 'update notifications', function (done) {
        
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
                createClient.call({
                    update_notification_handler: 'http://bar.com'
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            // And one client which 
            // doesn't handle update notificatons
            createClient2: function (cb) {
                createClient.call({
                    update_notification_handler: undefined
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            createEntityIDForUser: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createOauthEntityID({
                    client: client.id,
                    user: user.id,
                    fake_id: mongoose.Types.ObjectId(),
                    real_id: user.id,
                    entities: ['users'],
                    use_test_account: false
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

            createEntityIDForUser2: ['createUser', 'createClient2', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient2;

                createOauthEntityID({
                    client: client.id,
                    user: user.id,
                    fake_id: mongoose.Types.ObjectId(),
                    real_id: user.id,
                    entities: ['users'],
                    use_test_account: false
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }],

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

            // We authorize the second client
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

            // We update the user
            updateUser: ['createEntityIDForUser',
                         'createEntityIDForUser2',
                         'createUserAuthorization', 
                         'createUserAuthorization2', 
                         function (cb, results) {

                var user = results.createUser;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                // Update fields that match 
                // authorized scope for the two clients
                user.first_name = mongoose.Types.ObjectId().toString();
                user.nickname = mongoose.Types.ObjectId().toString();
                
                user.nationality = 'US';
                user.timezone = 'Europe/Dublin';

                user._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                user._oauth_entities_id = [
                    entityIDForUser,
                    entityIDForUser2
                ];

                sendNotificationToClients('users').call(user, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            assertItHasNotUpdatedOauthNotifications: ['updateUser', function (cb, results) {
                var client = results.createClient;
                var entityIDForUser = results.createEntityIDForUser;

                findOauthNotifications([client.id],
                                       [entityIDForUser.fake_id],
                                       function (err, oauthNotifications) {

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthNotifications.length, 0);

                    cb(null);
                });
            }],

            // We assert that the Oauth 
            // notification was not set in SQS
            assertItHasNotSetOauthNotifInSQS: ['updateUser', function (cb, results) {
                findLastOauthNotification(function (err, oauthNotification) {
                    var notifications = [];

                    if (err) {
                        return cb(err);
                    }

                    assert.ok(!oauthNotification);

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