var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var db = require('../../../../../models');

var updateOauthUserStatus = require('../../../../../models/middlewares/pre/save/updateOauthUserStatus');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var createUser = require('../../../../../testUtils/db/createUser');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');
var createClient = require('../../../../../testUtils/db/createOauthClient');
var createOauthUserStatus = require('../../../../../testUtils/db/createOauthUserStatus');

var findOauthUserStatus = require('../../../../../testUtils/db/findOauthUserStatus');

describe('models.middlewares.pre.save.'
         + 'updateOauthUserStatus (New entity)', function () {
    
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('updates oauth user status when '
       + 'clients ask for this entity type', function (done) {
        
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

            // We create the address
            createAddress: ['createOauthUserStatus', 
                            'createOauthUserStatus2', 
                            function (cb, results) {

                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var userAuthorization2 = results.createUserAuthorization2;
                var address = new db.models.Address({
                    full_name: 'Sheldon Cooper',
                    address_line_1: '725 passadena east street',
                    city: 'San Francisco',
                    postal_code: '76373',
                    country: 'US',
                    address_type: 'residential',
                    user: user.id
                });

                address._granted_authorizations = [
                    userAuthorization,
                    userAuthorization2
                ];

                address._oauth_entities_id = [];

                updateOauthUserStatus('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            // We assert that the two user status 
            // were updated accordingly to authorized scope
            assertItHasUpdatedUserStatus: ['createAddress', function (cb, results) {
                var user = results.createUser;
                var address = results.createAddress;
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
                        // `updated_fields` field contains ALL 
                        // updated field not only the one 
                        // wanted by client. 
                        assert.ok(compareArray(
                            userStatus.updated_fields,
                            ['addresses']
                        ));

                        assert.strictEqual(userStatus.updated_addresses.length, 1);

                        assert.strictEqual(userStatus.updated_addresses[0].id.toString(), 
                                           address.id.toString());

                        assert.strictEqual(userStatus.updated_addresses[0].status, 
                                           'new');

                        assert.ok(compareArray(
                            userStatus.updated_addresses[0].updated_fields, 
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
    
    it('doesn\'t update oauth user status when clients '
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

            // We create the address
            createAddress: ['createOauthUserStatus',
                            function (cb, results) {

                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var address = new db.models.Address({
                    full_name: 'Sheldon Cooper',
                    address_line_1: '725 passadena east street',
                    city: 'San Francisco',
                    postal_code: '76373',
                    country: 'US',
                    address_type: 'residential',
                    user: user.id
                });

                address._granted_authorizations = [];

                updateOauthUserStatus('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            // We assert it has not updated the user status
            assertItHasNotUpdatedUserStatus: ['createAddress', function (cb, results) {
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
                            userStatus.updated_addresses.toObject(),
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
    
    it('doesn\'t update oauth user status when '
       + 'clients ask for this entity type but handle '
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

            // And one client
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

            // We create the address
            createAddress: ['createOauthUserStatus',
                            function (cb, results) {

                var user = results.createUser;
                var userAuthorization = results.createUserAuthorization;
                var address = new db.models.Address({
                    full_name: 'Sheldon Cooper',
                    address_line_1: '725 passadena east street',
                    city: 'San Francisco',
                    postal_code: '76373',
                    country: 'US',
                    address_type: 'residential',
                    user: user.id
                });

                address._granted_authorizations = [
                    userAuthorization
                ];

                updateOauthUserStatus('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            // We assert it has not updated the user status
            assertItHasNotUpdatedUserStatus: ['createAddress', function (cb, results) {
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
                            userStatus.updated_addresses.toObject(),
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