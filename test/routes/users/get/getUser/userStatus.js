var request = require('supertest');
var assert = require('assert');

var querystring = require('querystring');
var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../../config');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var updateOauthClient = require('../../../../../testUtils/clients/update');
var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var createUser = require('../../../../../testUtils/db/createUser');
var createAddress = require('../../../../../testUtils/users/createAddress');

var updateUser = require('../../../../../testUtils/users/update');
var updateEmail = require('../../../../../testUtils/users/updateEmail');
var updatePhoneNumber = require('../../../../../testUtils/users/updatePhoneNumber');
var updateAddress = require('../../../../../testUtils/users/updateAddress');

var isValidOauthAuthorizeSuccessRedirect = require('../../../../../testUtils/validators/isValidOauthAuthorizeSuccessRedirect');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;
var app = null;

var appAccessToken = null;
var accessToken = null;

var appAccessToken2 = null;
var accessToken2 = null;

var oauthAuthBeforeHookResp = null;

var client = null;
var redirectionURI = null;

var client2 = null;
var redirectionURI2 = null;

var user = null;

var userID = null;
var userID2 = null;

var realUserID = null;

var singularFields = null;

var assertStatusWasReseted = function (done) {
    var context = this;

    makeARequest.call(context, 200, function (err, users) {
        if (err) {
            return done(err);
        }

        users.forEach(function (user) {
            assert.strictEqual(user.status, 'existing_user');
            assert.ok(compareArray(user.updated_fields, []));

            Object.keys(config.EVENID_OAUTH.VALID_ENTITY_FIELDS)
                  .forEach(function (entityName) {
                
                if (entityName === 'USERS') {
                    return;
                }

                user[entityName.toLowerCase()].forEach(function (entity) {
                    assert.strictEqual(entity.status, 'old');

                    assert.ok(compareArray(entity.updated_fields, []));
                });
            });
        });

        done();
    });
};

var testWithTestUser = function (done) {
    async.auto({
        // Make sure previous tests 
        // don't authorize client for user
        deleteAuthorizedClientForUser: function (cb) {
            deleteAuthorizedClientForUser(appAccessToken, user.id, 
                                          client.id, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // Make sure client authorizes test accounts
        updateOauthClient: function (cb) {
            updateOauthClient(accessToken, 
                              client.id, 
                              {authorize_test_accounts: 'true'}, 
                              function (err, oauthClient) {

                if (err) {
                    return cb(err);
                }

                cb(null, oauthClient);
            });
        },

        // We need to known redirection uri response type
        updateOauthRedirectionURI: function (cb) {
            updateOauthRedirectionURI(accessToken, 
                                      client.id,
                                      redirectionURI.id,
                                      {
                                        response_type: 'token'
                                      }, function (err) {

                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // User use a test account here
        useTestAccount: ['deleteAuthorizedClientForUser', 
                         'updateOauthClient',
                         'updateOauthRedirectionURI', function (cb, results) {

            var query = {
                client_id: client.client_id.toString(),
                redirect_uri: redirectionURI.uri,
                state: 'foo',
                flow: 'registration'
            };

            request(app)
                .post('/oauth/authorize?' + querystring.stringify(query))
                .set('X-Originating-Ip', '127.0.0.1')
                .set('Authorization', 'Bearer ' + appAccessToken)
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                    use_test_account: 'true'
                })
                .expect(200, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
        }]
    }, function (err, results) {
        var useTestAccountReply = results && results.useTestAccount;

        if (err) {
            return done(err);
        }

        done(null, useTestAccountReply);
    });
};

describe('GET /users/:user_id (User status)', function () {
    before(function (done) {
        async.auto({
            // First, user authorize one client
            getOauthClientAccessToken: function (cb) {
                getOauthClientAccessToken(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            },

            // We want to authorize another client for same user
            oauthAuthorizeBeforeHook: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                oauthAuthorizeBeforeHook.call({
                    user: resp.user,
                    accessToken: resp.appAccessToken
                }, function (err, resp) {
                    var validFormData = resp.validFormData;

                    if (err) {
                        return cb(err);
                    }

                    resp.validFormData = function () {
                        var data = validFormData();

                        // We don't want to add new phone numbers
                        // nor addresses. Easier to test.
                        resp.user.phone_numbers.forEach(function (phoneNumber) {
                            if (phoneNumber.phone_type === 'mobile') {
                                data.mobile_phone_number = phoneNumber.id;

                                return;
                            }

                            data.landline_phone_number = phoneNumber.id;
                        })

                        data.shipping_address = resp.user.addresses[0].id;
                        data.billing_address = resp.user.addresses[1].id;

                        return data;
                    };

                    cb(null, resp);
                });
            }],

            // We authorize another client for same user
            getOauthClientAccessToken2: ['oauthAuthorizeBeforeHook', function (cb, results) {
                var resp = results.oauthAuthorizeBeforeHook;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: resp
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var resp = results.getOauthClientAccessToken;
            var resp2 = results.getOauthClientAccessToken2;

            if (err) {
                return done(err);
            }

            oauthAuthBeforeHookResp = resp.oauthAuthBeforeHookResp;

            app = resp.app;

            appAccessToken = resp.appAccessToken;
            accessToken = resp.accessToken;

            appAccessToken2 = resp2.appAccessToken;
            accessToken2 = resp2.accessToken;

            client = resp.client;
            redirectionURI = resp.redirectionURI;

            client2 = resp2.client;
            redirectionURI2 = resp2.redirectionURI;

            user = resp.user;
            userID = resp.fakeUserID;
            userID2 = resp2.fakeUserID;
            realUserID = resp.user.id;

            singularFields = resp.singularFields;
            
            makeARequest = function (statusCode, done) {
                var cb = function (err, accessToken, userID, done) {
                    if (err) {
                        return done(err);
                    }

                    request(app)
                        .get('/users/' + userID)
                        .set('Authorization', 'Bearer ' + accessToken)
                        .expect('Content-Type', 'application/json; charset=utf-8')
                        .expect('Cache-Control', 'no-store')
                        .expect('Pragma', 'no-cache')
                        .expect(statusCode, function (err, resp) {
                            if (err) {
                                return done(err);
                            }

                            assert.doesNotThrow(function () {
                                JSON.parse(resp.text);
                            });

                            done(null, resp.body);
                        });
                };

                if (this.accessToken) {
                    return cb(null, this.accessToken, this.userID, function (err, user) {
                        done(err, [user]);
                    });
                }

                cb(null, accessToken, userID, function (err, user) {
                    if (err) {
                        return done(err);
                    }

                    cb(null, accessToken2, userID2, function (err, user2) {
                        if (err) {
                            return done(err);
                        }

                        done(null, [user, user2]);
                    });
                });
            };

            // We mock `getAccessToken` function
            createAddress = createAddress(app, function (cb) {
                cb(null, appAccessToken, user);
            });

            updateOauthClient = updateOauthClient(app);
            updateOauthRedirectionURI = updateOauthRedirectionURI(app);
            deleteAuthorizedClientForUser = deleteAuthorizedClientForUser(app);

            updateUser = updateUser(app);
            updateEmail = updateEmail(app);
            updatePhoneNumber = updatePhoneNumber(app);
            updateAddress = updateAddress(app);

            done();
        });
    });

    it('responds with `new_user` the first time '
       + 'we call the GET users API method', function (done) {

        makeARequest(200, function (err, users) {
            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assert.strictEqual(user.status, 'new_user');

                assert.ok(compareArray(user.updated_fields, []));

                Object.keys(config.EVENID_OAUTH.VALID_ENTITY_FIELDS)
                      .forEach(function (entityName) {
                    
                    if (entityName === 'USERS') {
                        return;
                    }

                    user[entityName.toLowerCase()].forEach(function (entity) {
                        assert.strictEqual(entity.status, 'new');

                        assert.ok(compareArray(entity.updated_fields, []));
                    });
                });
            });

            done();
        });
    });

    it('responds with `existing_user` the second time '
       + 'we call the GET users API method', function (done) {

        assertStatusWasReseted(done);
    });

    it('responds with `existing_user_after_update` when user has '
       + 'updated fields asked by client', function (done) {

        var update = {};

        singularFields.forEach(function (singularField) {
            update[singularField] = mongoose.Types.ObjectId().toString();

            if (singularField === 'gender') {
                update[singularField] = 'male';
            }

            if (singularField === 'date_of_birth') {
                update.date_of_birth_month = '12';
                update.date_of_birth_day = '17';
                update.date_of_birth_year = '1942';
            }

            if (['place_of_birth', 'nationality'].indexOf(singularField) !== -1) {
                update[singularField] = 'IT';
            }

            if (singularField === 'timezone') {
                update[singularField] = 'Europe/Dublin';
            }
        });

        updateUser(appAccessToken, realUserID, 
                   update, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, users) {
                var executedFn = 0;

                if (err) {
                    return done(err);
                }

                users.forEach(function (user) {
                    assert.strictEqual(user.status, 'existing_user_after_update');

                    delete update.date_of_birth_month;
                    delete update.date_of_birth_day;
                    delete update.date_of_birth_year;

                    assert.strictEqual(user.updated_fields.length,
                                       Object.keys(update).length);

                    assert.ok(compareArray(user.updated_fields,
                                           Object.keys(update)));

                    assertStatusWasReseted(function (err) {
                        if (err) {
                            return done(err);
                        }

                        executedFn++;

                        if (executedFn === users.length) {
                            return done();
                        }
                    });
                });
            });
        });
    });
    
    it('responds with `existing_user_after_update` when user has '
       + 'updated email fields asked by client', function (done) {

        var update = {};
        var emailID = user.emails[0].id;

        update.email = mongoose.Types.ObjectId().toString() + '@evenid.com';
        update.password = user.password;

        updateEmail(appAccessToken, realUserID, 
                    emailID, update, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, users) {
                var executedFn = 0;

                if (err) {
                    return done(err);
                }

                users.forEach(function (user) {

                    assert.strictEqual(user.status, 'existing_user_after_update');

                    assert.strictEqual(user.updated_fields.length, 1);
                    assert.strictEqual(user.updated_fields[0], 'emails');

                    assert.strictEqual(user.emails[0].status, 'updated');
                    assert.strictEqual(user.emails[0].updated_fields.length, 1);
                    assert.strictEqual(user.emails[0].updated_fields[0], 'address');

                    assertStatusWasReseted(function (err) {
                        if (err) {
                            return done(err);
                        }
                        
                        executedFn++;

                        if (executedFn === users.length) {
                            return done();
                        }
                    });
                });
            });
        });
    });

    it('responds with `existing_user_after_update` when user has '
       + 'updated phone number fields asked by client', function (done) {

        var update = {};
        var phoneNumberID = null;

        // Client ask for mobile and 
        // landline phone number per default
        // Make sure the update could match a phone type
        update.number = '+33639844756';
        update.country = 'FR';

        user.phone_numbers.forEach(function (phoneNumber) {
            if (phoneNumber.phone_type !== 'mobile') {
                return;
            }

            phoneNumberID = phoneNumber.id;
        });

        updatePhoneNumber(appAccessToken, realUserID, 
                          phoneNumberID, update, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, users) {
                var oldPhoneNumber = null;
                var updatedPhoneNumber = null;

                var executedFn = 0;

                if (err) {
                    return done(err);
                }

                users.forEach(function (user) {
                    assert.strictEqual(user.status, 'existing_user_after_update');

                    assert.strictEqual(user.updated_fields.length, 1);
                    assert.strictEqual(user.updated_fields[0], 'phone_numbers');

                    if (user.phone_numbers[0].status === 'old') {
                        oldPhoneNumber = user.phone_numbers[0];
                        updatedPhoneNumber = user.phone_numbers[1];
                    } else {
                        oldPhoneNumber = user.phone_numbers[1];
                        updatedPhoneNumber = user.phone_numbers[0];
                    }

                    assert.strictEqual(updatedPhoneNumber.status, 'updated');

                    assert.strictEqual(updatedPhoneNumber.updated_fields.length, 1);
                    assert.ok(compareArray(updatedPhoneNumber.updated_fields,
                                           ['number']));

                    assert.strictEqual(oldPhoneNumber.updated_fields.length, 0);
                    assert.strictEqual(oldPhoneNumber.status, 'old');

                    assertStatusWasReseted(function (err) {
                        if (err) {
                            return done(err);
                        }
                        
                        executedFn++;

                        if (executedFn === users.length) {
                            return done();
                        }
                    });
                });
            });
        });
    });

    it('responds with `existing_user_after_update` when user has '
       + 'updated address fields asked by client', function (done) {

        var update = {};
        var addressID = user.addresses[0].id;
        
        update.full_name = mongoose.Types.ObjectId().toString();
        update.address_line_1 = mongoose.Types.ObjectId().toString();
        update.address_line_2 = mongoose.Types.ObjectId().toString();
        update.country = 'IT';
        update.address_type = 'commercial';
        update.city = mongoose.Types.ObjectId().toString();
        update.access_code = '308094';

        updateAddress(appAccessToken, realUserID, 
                      addressID, update, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, users) {
                var oldAddress = null;
                var updatedAddress = null;

                var executedFn = 0;

                if (err) {
                    return done(err);
                }

                users.forEach(function (user) {
                    assert.strictEqual(user.status, 'existing_user_after_update');
                    
                    assert.strictEqual(user.updated_fields.length, 1);
                    assert.strictEqual(user.updated_fields[0], 'addresses');

                    if (user.addresses[0].status === 'old') {
                        updatedAddress = user.addresses[1];
                        oldAddress = user.addresses[0];
                    } else {
                        updatedAddress = user.addresses[0];
                        oldAddress = user.addresses[1];
                    }

                    assert.strictEqual(updatedAddress.status, 'updated');

                    assert.strictEqual(updatedAddress.updated_fields.length,
                                       Object.keys(update).length);
                    
                    assert.ok(compareArray(updatedAddress.updated_fields,
                                           Object.keys(update)));

                    assert.strictEqual(oldAddress.updated_fields.length, 0);
                    assert.strictEqual(oldAddress.status, 'old');

                    assertStatusWasReseted(function (err) {
                        if (err) {
                            return done(err);
                        }
                        
                        executedFn++;

                        if (executedFn === users.length) {
                            return done();
                        }
                    });
                });
            });
        });
    });
    
    it('responds with `existing_user_after_update` when user has '
       + 'authorized access to another address for client', function (done) {
        
        // Create address was mocked
        // to use app token and user
        createAddress(function (err, accessToken, userID, 
                                addressID, addressLine1) {
            
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, users) {
                var executedFn = 0;

                if (err) {
                    return done(err);
                }

                users.forEach(function (user) {
                    var newAddresses = [];

                    assert.strictEqual(user.status, 'existing_user_after_update');

                    assert.strictEqual(user.updated_fields.length, 1);
                    assert.strictEqual(user.updated_fields[0], 'addresses');

                    user.addresses.forEach(function (address) {
                        if (address.status !== 'new') {
                            return;
                        }

                        newAddresses.push(address);
                    });

                    assert.strictEqual(newAddresses.length, 1);

                    newAddresses.forEach(function (newAddress) {
                        assert.strictEqual(newAddress.status, 'new');

                        assert.strictEqual(newAddress.updated_fields.length, 0);
                    });

                    assertStatusWasReseted(function (err) {
                        if (err) {
                            return done(err);
                        }
                        
                        executedFn++;

                        if (executedFn === users.length) {
                            return done();
                        }
                    });
                });
            });
        });
    });

    it('responds with `existing_user_after_test` when user has '
       + 'used a test account before registering for real', function (done) {

        async.auto({
            // User use a test account here: `new_user`
            useTestAccount: function (cb) {
                testWithTestUser(function (err, resp) {
                    var respBody = resp.body;
                    var isTestAccount = true;
                    var isLoggedUser = true;

                    if (err) {
                        return cb(err);
                    }

                    // This method will call the GET users api method
                    // and update the oauth user status from `new_user` 
                    // to `existing_user` to allow passing to `existing_user_after_test`
                    isValidOauthAuthorizeSuccessRedirect('token', redirectionURI.uri, isTestAccount, 
                                                         isLoggedUser, respBody, app, client,
                                                         function (err, testUser) {

                        if (err) {
                            return cb(err);
                        }

                        cb(null, testUser);
                    });
                });
            },

            // From `existing_user` to `existing_user_after_test`
            authorizeClientToUser: ['useTestAccount', function (cb, results) {
                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: oauthAuthBeforeHookResp
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var authorizeClientToUserResp = results && results.authorizeClientToUser;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: authorizeClientToUserResp.accessToken,
                userID: authorizeClientToUserResp.fakeUserID
            }, 200, function (err, users) {
                var user = users && users[0];

                if (err) {
                    return done(err);
                }

                /* Assert `status` and `updated_fields` fields were updated */

                assert.strictEqual(user.status, 'existing_user_after_test');

                assert.ok(compareArray(user.updated_fields,
                                       config.EVENID_OAUTH.VALID_USER_SCOPE));

                Object.keys(config.EVENID_OAUTH.VALID_ENTITY_FIELDS)
                      .forEach(function (entityName) {
                    
                    var entityNB = 2;

                    if (entityName === 'USERS') {
                        return;
                    }

                    if (entityName === 'EMAILS') {
                        entityNB = 1;
                    }

                    // - Before hook create two addresses 
                    // when client was authorized (Shipping/Billing) -> 2
                    // - When user has authorized access to another 
                    // address for client (in previous test) -> +1
                    // - When we reauthorize client after test -> +2 (Shipping/Billing)
                    if (entityName === 'ADDRESSES') {
                        entityNB = 5;
                    }

                    assert.strictEqual(user[entityName.toLowerCase()].length, entityNB);

                    user[entityName.toLowerCase()].forEach(function (entity) {
                        assert.strictEqual(entity.status, 'updated');

                        assert.ok(compareArray(
                            entity.updated_fields,
                            config.EVENID_OAUTH.VALID_ENTITY_FIELDS[entityName.toUpperCase()]
                        ));
                    });
                });

                /* END */

                // Assert we go back to `existing_user`
                assertStatusWasReseted.call({
                    accessToken: authorizeClientToUserResp.accessToken,
                    userID: authorizeClientToUserResp.fakeUserID
                }, done);
            });
        });
    });
});