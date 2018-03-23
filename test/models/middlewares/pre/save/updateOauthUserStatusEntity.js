var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var db = require('../../../../../models');

var updateOauthUserStatus = require('../../../../../models/middlewares/pre/save/updateOauthUserStatus');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var createUser = require('../../../../../testUtils/db/createUser');
var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');
var createClient = require('../../../../../testUtils/db/createOauthClient');
var createOauthUserStatus = require('../../../../../testUtils/db/createOauthUserStatus');

var findOauthUserStatus = require('../../../../../testUtils/db/findOauthUserStatus');

describe('models.middlewares.pre.save.updateOauthUserStatus (Entity)', function () {
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
       + 'which have asked for this entity', function (done) {
        
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

            // We update the phone number
            updatePhoneNumber: ['createPhoneNumber',
                                'createOauthUserStatus', 
                                'createOauthUserStatus2', 
                                function (cb, results) {

                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;

                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;
                
                phoneNumber.number = '0645364737';
                phoneNumber.country = 'FR';
                phoneNumber._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                updateOauthUserStatus('phone_numbers').call(phoneNumber, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // We assert that the two user status 
            // were updated accordingly to authorized scope
            assertItHasUpdatedUserStatus: ['updatePhoneNumber', function (cb, results) {
                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;
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
                            ['phone_numbers']
                        ));

                        assert.strictEqual(userStatus.updated_phone_numbers.length, 1);

                        assert.strictEqual(userStatus.updated_phone_numbers[0].id.toString(), 
                                           phoneNumber.id.toString());

                        assert.strictEqual(userStatus.updated_phone_numbers[0].status, 
                                           'updated');

                        assert.ok(compareArray(
                            userStatus.updated_phone_numbers[0].updated_fields, 
                            ['number']
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
       + 'which handle update notifications', function (done) {
        
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
                    user: user.id
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

            // And one client which handle update notificatons
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

            // We authorize the client
            createUserAuthorization: ['createUser', 'createClient', function (cb, results) {
                var user = results.createUser;
                var client = results.createClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
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

            // We create user status for the client
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

            // We update the phone number
            updatePhoneNumber: ['createPhoneNumber',
                                'createOauthUserStatus',  
                                function (cb, results) {

                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;
                var userAuthorization = results.createUserAuthorization;
                
                phoneNumber.number = '0645364737';
                phoneNumber.country = 'FR';
                phoneNumber._granted_authorizations = [
                    userAuthorization
                ];

                updateOauthUserStatus('phone_numbers').call(phoneNumber, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // We assert it has not updated the user status
            assertItHasNotUpdatedUserStatus: ['updatePhoneNumber', function (cb, results) {
                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;

                findOauthUserStatus([userAuthorization.client.id], 
                                    [user.id], function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    // Make sure we have the status for the client
                    assert.strictEqual(oauthUserStatus.length, 1);

                    oauthUserStatus.forEach(function (userStatus) {
                        /* Make sure status was not updated */

                        assert.strictEqual(userStatus.status, 'existing_user');

                        assert.ok(compareArray(
                            userStatus.updated_fields,
                            []
                        ));

                        assert.ok(compareArray(
                            userStatus.updated_phone_numbers.toObject(),
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
    
    it('doesn\'t update oauth user status when only '
       + 'phone number type was updated and phone type '
       + 'equals `old_phone_type`', function (done) {
        
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
                    user: user.id
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

            // And one client
            createClient: function (cb) {
                createClient(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            // We authorize the client
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

            // We create user status for the client
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

            // We update the phone number type
            updatePhoneNumber: ['createPhoneNumber',
                                'createOauthUserStatus',
                                function (cb, results) {

                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;
                var oldPhoneType = phoneNumber.phone_type;

                var userAuthorization = results.createUserAuthorization;
                
                phoneNumber.phone_type = undefined;
                phoneNumber.phone_type = oldPhoneType;
                phoneNumber._granted_authorizations = [
                    userAuthorization
                ];

                updateOauthUserStatus('phone_numbers').call(phoneNumber, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // We assert that the user 
            // status was not updated
            assertItHasNotUpdatedUserStatus: ['updatePhoneNumber', function (cb, results) {
                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;
                var userAuthorization = results.createUserAuthorization;

                findOauthUserStatus([userAuthorization.client.id], 
                                    [user.id], function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    // Make sure we have the status for the client
                    assert.strictEqual(oauthUserStatus.length, 1);

                    oauthUserStatus.forEach(function (userStatus) {
                        // Make sure status was not updated
                        assert.strictEqual(userStatus.status, 'existing_user');

                        assert.deepEqual(userStatus.updated_fields.toObject(), []);

                        assert.strictEqual(userStatus.updated_phone_numbers.length, 0);
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