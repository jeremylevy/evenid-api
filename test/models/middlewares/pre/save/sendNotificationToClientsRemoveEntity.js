var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var db = require('../../../../../models');

var sendNotificationToClients = require('../../../../../models/middlewares/pre/save/sendNotificationToClients');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var createUser = require('../../../../../testUtils/db/createUser');
var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');
var createClient = require('../../../../../testUtils/db/createOauthClient');

var createOauthEntityID = require('../../../../../testUtils/db/createOauthEntityID');

var findOauthNotifications = require('../../../../../testUtils/db/findOauthNotifications');
var findLastOauthNotification = require('../../../../../testUtils/db/findLastOauthNotification');

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

describe('models.middlewares.pre.save.'
         + 'sendNotificationToClients (Remove entity)', function () {
    
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
      + 'have asked for removed entity', function (done) {

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

            createPhoneNumber: ['createUser', function (cb, results) {
                var user = results.createUser;

                createPhoneNumber.call({
                    number: '0491485948',
                    country: 'FR',
                    phone_type: 'landline',
                    user: user.id
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

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

                createEntityID(user.id, client.id, user.id, ['users'], cb);
            }],

            createEntityIDForUser2: ['createUser', 'createClient2', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient2;

                createEntityID(user.id, client.id, user.id, ['users'], cb);
            }],

            createEntityIDForPhone: ['createUser', 'createClient', 
                                     'createPhoneNumber', function (cb, results) {
                
                var user = results.createUser;
                var client = results.createClient;
                var phoneNumber = results.createPhoneNumber;
                // Match updated phone type
                var entities = ['mobile_phone_numbers'];

                createEntityID(user.id, client.id, 
                               phoneNumber.id, entities, cb);
            }],

            createEntityIDForPhone2: ['createUser', 'createClient2', 
                                      'createPhoneNumber', function (cb, results) {
                
                var user = results.createUser;
                var client = results.createClient2;
                var phoneNumber = results.createPhoneNumber;
                // Match updated phone type
                var entities = ['mobile_phone_numbers'];

                createEntityID(user.id, client.id, 
                               phoneNumber.id, entities, cb);
            }],

            // We authorize the first client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    scope: ['phone_numbers']
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
                    scope: ['phone_numbers']
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

            // We update the phone number
            updatePhoneNumber: ['createUserAuthorization',
                                'createUserAuthorization2',
                                'createEntityIDForUser',
                                'createEntityIDForUser2',
                                'createEntityIDForPhone',
                                'createEntityIDForPhone2', 
                                function (cb, results) {

                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;

                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                var entityIDForPhone = results.createEntityIDForPhone;
                var entityIDForPhone2 = results.createEntityIDForPhone2;
                
                phoneNumber.number = '0645364737';
                phoneNumber.phone_type = 'mobile';
                phoneNumber.country = 'FR';
                
                phoneNumber._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                phoneNumber._oauth_entities_id = [
                    entityIDForUser,
                    entityIDForUser2,
                    entityIDForPhone,
                    entityIDForPhone2
                ];

                sendNotificationToClients.call({
                    eventName: 'remove'
                }, 'phone_numbers').call(phoneNumber, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

            assertItHasUpdatedOauthNotifications: ['updatePhoneNumber', function (cb, results) {
                var updatedPhoneNumber = results.updatePhoneNumber;

                var client = results.createClient;
                var client2 = results.createClient2;

                var user = results.createUser;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                var entityIDForPhone = results.createEntityIDForPhone;
                var entityIDForPhone2 = results.createEntityIDForPhone2;

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
                        var isValidPhoneNumber = function (fakeID) {
                            return function (phoneNumber) {
                                assert.strictEqual(Object.keys(phoneNumber).length, 3);

                                assert.strictEqual(phoneNumber.id,
                                                   fakeID.toString());

                                assert.strictEqual(phoneNumber.status, 'deleted');
                                
                                assert.ok(compareArray(phoneNumber.updated_fields,
                                                       []));
                            };
                        };

                        assert.strictEqual(oauthNotification.pending_notifications.length, 1);

                        if (notificationObj.client_secret !== client.client_secret) {
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

                        assert.ok(compareArray(notification.updated_fields,
                                  ['phone_numbers']));

                        assert.strictEqual(notification.phone_numbers.length, 1);

                        if (wantedClient === client2) {
                            assert.strictEqual(notification.user_id,
                                               entityIDForUser2.fake_id.toString());

                            notification.phone_numbers.forEach(function (phoneNumber) {
                                isValidPhoneNumber(entityIDForPhone2.fake_id)(phoneNumber);
                            });
                        } else {
                            assert.strictEqual(notification.user_id,
                                               entityIDForUser.fake_id.toString());

                            notification.phone_numbers.forEach(function (phoneNumber) {
                                isValidPhoneNumber(entityIDForPhone.fake_id)(phoneNumber);
                            });
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
            assertItHasSetOauthNotifInSQS: ['updatePhoneNumber', function (cb, results) {
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
});