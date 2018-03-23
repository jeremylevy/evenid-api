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

describe('models.middlewares.pre.save.updateOauthUserStatus (Remove entity)', function () {
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

            // One client which must be notified
            createClient: function (cb) {
                createClient(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            },

            // We authorize the client
            createUserAuthorization: ['createUser', 
                                      'createClient', function (cb, results) {
                
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

            // We update the phone number
            updatePhoneNumber: ['createPhoneNumber',
                                'createOauthUserStatus', 
                                function (cb, results) {

                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;

                var userAuthorization = results.createUserAuthorization;

                phoneNumber._granted_authorizations = [
                    userAuthorization
                ];

                updateOauthUserStatus.call({
                    eventName: 'remove'
                }, 'phone_numbers').call(phoneNumber, function (err) {
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

                findOauthUserStatus([userAuthorization.client.id], 
                                    [user.id], function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    // Make sure we have the status for the client
                    assert.strictEqual(oauthUserStatus.length, 1);

                    oauthUserStatus.forEach(function (userStatus) {
                        // Make sure status was updated for the two clients
                        assert.strictEqual(userStatus.status, 'existing_user_after_update');

                        // In order to ease the updated process
                        // `updated_fields` field contains ALL 
                        // updated field not only the one 
                        // wanted by client. 
                        assert.ok(compareArray(
                            userStatus.updated_fields,
                            ['phone_numbers']
                        ));

                        assert.strictEqual(userStatus.updated_phone_numbers.length, 1);

                        assert.strictEqual(userStatus.updated_phone_numbers[0].id.toString(), 
                                           phoneNumber.id.toString());

                        assert.strictEqual(userStatus.updated_phone_numbers[0].status, 
                                           'deleted');

                        assert.ok(compareArray(
                            userStatus.updated_phone_numbers[0].updated_fields, 
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