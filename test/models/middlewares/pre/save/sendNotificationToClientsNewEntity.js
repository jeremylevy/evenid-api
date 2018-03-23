var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../../config');

var db = require('../../../../../models');

var sendNotificationToClients = require('../../../../../models/middlewares/pre/save/sendNotificationToClients');

var createUser = require('../../../../../testUtils/db/createUser');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var createClient = require('../../../../../testUtils/db/createOauthClient');
var createOauthEntityID = require('../../../../../testUtils/db/createOauthEntityID');

var findOauthNotifications = require('../../../../../testUtils/db/findOauthNotifications');
var findLastOauthNotification = require('../../../../../testUtils/db/findLastOauthNotification');

var compareArray = require('../../../../../testUtils/lib/compareArray');

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
         + 'sendNotificationToClients (New entity)', function () {
    
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('notifies clients which have asked '
       + 'for this entity type', function (done) {
        
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

            createAddress: ['createUser', function (cb, results) {
                var user = results.createUser;
                
                var address = new db.models.Address({
                    full_name: 'Sheldon Cooper',
                    address_line_1: '725 passadena east street',
                    city: 'San Francisco',
                    postal_code: '76373',
                    country: 'US',
                    address_type: 'residential',
                    user: user.id
                });

                cb(null, address);
            }],

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

            createEntityIDForAddress: ['createClient',
                                       'createAddress', function (cb, results) {
                
                var user = results.createUser;
                var client = results.createClient;
                
                var address = results.createAddress;
                var entities = ['addresses'];

                createEntityID(user.id, client.id, 
                               address.id, entities, cb);
            }],

            createEntityIDForAddress2: ['createClient2',
                                        'createAddress', function (cb, results) {
                
                var user = results.createUser;
                var client = results.createClient2;
                
                var address = results.createAddress;
                var entities = ['addresses'];

                createEntityID(user.id, client.id, 
                               address.id, entities, cb);
            }],

            // We authorize the first client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    scope: ['addresses']
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
                    scope: ['addresses']
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

            // We create the address
            sendNotificationToClients: ['createUserAuthorization',
                                        'createUserAuthorization2',
                                        'createEntityIDForUser',
                                        'createEntityIDForUser2',
                                        'createEntityIDForAddress',
                                        'createEntityIDForAddress2',
                                        function (cb, results) {

                var userAuthorization = results.createUserAuthorization;
                
                var userAuthorization2 = results.createUserAuthorization2;
                var address = results.createAddress;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                var entityIDForAddress = results.createEntityIDForAddress;
                var entityIDForAddress2 = results.createEntityIDForAddress2;

                address._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                address._oauth_entities_id = [
                    entityIDForUser,
                    entityIDForUser2,
                    entityIDForAddress,
                    entityIDForAddress2
                ];

                sendNotificationToClients('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            assertItHasUpdatedOauthNotifications: ['sendNotificationToClients', function (cb, results) {
                var updatedAddress = results.sendNotificationToClients;

                var client = results.createClient;
                var client2 = results.createClient2;

                var user = results.createUser;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForUser2 = results.createEntityIDForUser2;

                var entityIDForAddress = results.createEntityIDForAddress;
                var entityIDForAddress2 = results.createEntityIDForAddress2;

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
                        var isValidAddress = function (fakeID) {
                            var validFields = config.EVENID_OAUTH
                                                    .VALID_ENTITY_FIELDS
                                                    .ADDRESSES;
                            
                            return function (address) {
                                // Don't forget `first_for` field!
                                assert.strictEqual(Object.keys(address).length, 12 + 1);

                                assert.strictEqual(address.id,
                                                   fakeID.toString());

                                validFields.forEach(function (field) {
                                    if (!updatedAddress[field]) {
                                        if (field === 'first_for') {
                                            return assert.deepEqual(address[field], []);
                                        }

                                        return assert.strictEqual(address[field], '');
                                    }

                                    assert.strictEqual(address[field],
                                                       updatedAddress[field]);
                                });

                                assert.strictEqual(address.status, 'new');

                                assert.ok(compareArray(address.updated_fields, []));
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
                                  ['addresses']));

                        assert.strictEqual(notification.addresses.length, 1);

                        if (wantedClient === client2) {
                            assert.strictEqual(notification.user_id,
                                               entityIDForUser2.fake_id.toString());

                            notification.addresses.forEach(function (address) {
                                isValidAddress(entityIDForAddress2.fake_id)(address);
                            });
                        } else {
                            assert.strictEqual(notification.user_id,
                                               entityIDForUser.fake_id.toString());

                            notification.addresses.forEach(function (address) {
                                isValidAddress(entityIDForAddress.fake_id)(address);
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
            // notification was created
            assertItHasSetOauthNotifInSQS: ['sendNotificationToClients', function (cb, results) {
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
                                : entityIDForUser2.fake_id.toString(),
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
    
    it('doesn\'t notify clients which '
       + 'don\'t ask for this entity type', function (done) {

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

            // One client
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

            createAddress: ['createUser', function (cb, results) {
                var user = results.createUser;
                
                var address = new db.models.Address({
                    full_name: 'Sheldon Cooper',
                    address_line_1: '725 passadena east street',
                    city: 'San Francisco',
                    postal_code: '76373',
                    country: 'US',
                    address_type: 'residential',
                    user: user.id
                });

                cb(null, address);
            }],

            createEntityIDForUser: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createEntityID(user.id, client.id, user.id, ['users'], cb);
            }],

            createEntityIDForAddress: ['createClient',
                                       'createAddress', function (cb, results) {
                
                var user = results.createUser;
                var client = results.createClient;
                
                var address = results.createAddress;
                var entities = ['addresses'];

                createEntityID(user.id, client.id, 
                               address.id, entities, cb);
            }],

            // We authorize the first client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    // Make sure we don't 
                    // authorize addresses
                    scope: ['emails']
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

            // We call the function
            sendNotificationToClients: ['createUserAuthorization',
                                        'createEntityIDForUser',
                                        'createEntityIDForAddress',
                                        function (cb, results) {

                var address = results.createAddress;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForAddress = results.createEntityIDForAddress;

                address._granted_authorizations = [];

                address._oauth_entities_id = [
                    entityIDForUser,
                    entityIDForAddress
                ];

                sendNotificationToClients('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            assertItHasNotUpdatedOauthNotifications: ['sendNotificationToClients', function (cb, results) {
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
            assertItHasNotSetOauthNotifInSQS: ['sendNotificationToClients', function (cb, results) {
                findLastOauthNotification(function (err, oauthNotification) {
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
    
    it('doesn\'t notify clients which ask for '
       + 'this entity type but don\'t handle '
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

            // One client
            createClient: function (cb) {
                createClient.call({
                    update_notification_handler: undefined
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            createAddress: ['createUser', function (cb, results) {
                var user = results.createUser;
                
                var address = new db.models.Address({
                    full_name: 'Sheldon Cooper',
                    address_line_1: '725 passadena east street',
                    city: 'San Francisco',
                    postal_code: '76373',
                    country: 'US',
                    address_type: 'residential',
                    user: user.id
                });

                cb(null, address);
            }],

            createEntityIDForUser: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createEntityID(user.id, client.id, user.id, ['users'], cb);
            }],

            createEntityIDForAddress: ['createClient',
                                       'createAddress', function (cb, results) {
                
                var user = results.createUser;
                var client = results.createClient;
                
                var address = results.createAddress;
                var entities = ['addresses'];

                createEntityID(user.id, client.id, 
                               address.id, entities, cb);
            }],

            // We authorize the first client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    scope: ['addresses']
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

            // We call the function
            sendNotificationToClients: ['createUserAuthorization',
                                        'createEntityIDForUser',
                                        'createEntityIDForAddress',
                                        function (cb, results) {

                var address = results.createAddress;
                var userAuthorization = results.createUserAuthorization;

                var entityIDForUser = results.createEntityIDForUser;
                var entityIDForAddress = results.createEntityIDForAddress;

                address._granted_authorizations = [
                    userAuthorization
                ];

                address._oauth_entities_id = [
                    entityIDForUser,
                    entityIDForAddress
                ];

                sendNotificationToClients('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            assertItHasNotUpdatedOauthNotifications: ['sendNotificationToClients', function (cb, results) {
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
            // notification was not created
            assertItHasNotSetOauthNotifInSQS: ['sendNotificationToClients', function (cb, results) {
                findLastOauthNotification(function (err, oauthNotification) {
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