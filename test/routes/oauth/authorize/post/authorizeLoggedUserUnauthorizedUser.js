var assert = require('assert');
var Type = require('type-of-is');
var request = require('supertest');

var querystring = require('querystring');
var mongoose = require('mongoose');
var async = require('async');

var config = require('../../../../../config');

var createEmail = require('../../../../../testUtils/db/createEmail');
var createUser = require('../../../../../testUtils/db/createUser');

var findOauthAuthorizations = require('../../../../../testUtils/db/findOauthAuthorizations');

var updateOauthClient = require('../../../../../testUtils/clients/update');
var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');
var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var isInvalidRequestError = require('../../../../../testUtils/validators/isInvalidRequestError');
var isValidOauthAuthorizeSuccessRedirect = require('../../../../../testUtils/validators/isValidOauthAuthorizeSuccessRedirect');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

var fullScope = null;
var fullScopeFlags = null;

var formFieldsMatchingFullScope = null;
var invalidFormFields = null;

var validFormData = null;
var userMatchPassedData = null;

describe('POST /oauth/authorize (Logged user) (Unauthorized user)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;
            accessToken = resp.accessToken;
            
            user = resp.user;
            client = resp.client;
            
            redirectionURI = resp.redirectionURI;
            formFieldsMatchingFullScope = resp.formFieldsMatchingFullScope;
            
            invalidFormFields = resp.invalidFormFields;
            validFormData = resp.validFormData;
            
            userMatchPassedData = resp.userMatchPassedData;
            fullScope = resp.fullScope;
            fullScopeFlags = resp.fullScopeFlags;

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            updateOauthClient = updateOauthClient(app);
            
            updateOauthRedirectionURI = updateOauthRedirectionURI(app);
            deleteAuthorizedClientForUser = deleteAuthorizedClientForUser(app);

            makeARequest = function (statusCode, data, cb) {
                var context = this;
                var flow = (context.flow || 'registration');
                var query = null;

                query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };

                request(app)
                    .post('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send(data)
                    .expect(statusCode, function (err, res) {
                        var resp = null;

                        if (err) {
                            return cb(err);
                        }

                        resp = res.body;

                        cb(null, resp);
                    });
            };
            
            done();
        });
    });

    it('responds with HTTP code 200 and `redirect_to_registration_flow` step '
       + 'reply when unregistered user try to send data through login form', function (done) {

        makeARequest.call({
            flow: 'login'
        }, 200, {}, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.step, 'redirect_to_registration_flow');
            assert.strictEqual(resp.clientName, client.name);

            done();
        });
    });
    
    it('responds with HTTP code 400 and '
       + '`invalid_request` error when empty form', function (done) {
        
        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: fullScope, 
                                    scope_flags: fullScopeFlags
                                  }, function (err) {
            
            if (err) {
                return done(err);
            }

            makeARequest(400, {}, function (err, resp) {
                var error = null;

                if (err) {
                    return done(err);
                }

                error = resp.error;
                
                // `formFieldsMatchingFullScope`: message properties
                isInvalidRequestError(error, formFieldsMatchingFullScope);

                done();
            });
        });
    });

    it('responds with HTTP code 400 and '
       + '`invalid_request` error when invalid form', function (done) {
        
        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: fullScope, 
                                    scope_flags: fullScopeFlags
                                  }, function (err) {

            var formData = {};
            
            if (err) {
                return done(err);
            }

            formFieldsMatchingFullScope.forEach(function (formField) {
                formData[formField] = 'bar';
            });

            makeARequest(400, formData, function (err, resp) {
                var error = null;

                if (err) {
                    return done(err);
                }

                error = resp.error;

                isInvalidRequestError(error, invalidFormFields);

                done();
            });
        });
    });

    it('responds with HTTP code 400 and '
       + '`invalid_request` error when unique index error', function (done) {
        
        async.auto({
            // First create fields which 
            // have unique constraints (ie: "nickname", "email")
            createEmail: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createUser: function (cb) {
                createUser.call({
                    user: {
                        nickname: mongoose.Types.ObjectId().toString()
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            // Make sure redirection uri scope contains email and nickname
            updateOauthRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: ['emails', 'nickname'], 
                                            scope_flags: []
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }
        }, function (err, results) {
            var email = results.createEmail;
            var createdUser = results.createUser;
            var formData = {};

            if (err) {
                return done(err);
            }

            formData.email = email.address;
            // We need user password to add an email
            formData.password = user.password;
            
            formData.nickname = createdUser.nickname;

            makeARequest(400, formData, function (err, resp) {
                var error = null;

                if (err) {
                    return done(err);
                }

                error = resp.error;

                isInvalidRequestError(error, ['email', 'nickname']);

                done();
            });
        });
    });

    it('responds with HTTP code 400 and '
       + '`invalid_request` error when user send the same number '
       + 'for mobile and landline phone numbers', function (done) {
        
        async.auto({
            // Make sure redirection uri scope 
            // contains mobile and landline phone number
            updateOauthRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: ['phone_numbers'], 
                                            scope_flags: ['mobile_phone_number', 
                                                          'landline_phone_number']
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }
        }, function (err, results) {
            var formData = {};

            if (err) {
                return done(err);
            }

            formData.mobile_phone_number_number 
                = formData.landline_phone_number_number
                = '732-757-2923';

            formData.mobile_phone_number_country 
                = formData.landline_phone_number_country  
                = 'US';

            makeARequest(400, formData, function (err, resp) {
                var error = null;

                if (err) {
                    return done(err);
                }

                error = resp.error;

                isInvalidRequestError(error, 
                                      ['mobile_phone_number_number', 
                                       'landline_phone_number_number']);

                done();
            });
        });
    });
    
    it('bounds test account to user when the '
       + 'user has used a test account while unlogged', function (done) {
        
        async.auto({
            // Make sure previous tests don't authorize client for user
            deleteAuthorizedClientForUser: function (cb) {
                deleteAuthorizedClientForUser(accessToken, user.id, 
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

            // Make sure redirection uri scope 
            // contains full scope to known what data
            // we need to send and what response type 
            // we need to test
            updateOauthRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: fullScope,
                                            scope_flags: fullScopeFlags,
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            // Create the test user
            createTestUser: function (cb) {
                createUser.call({
                    user: {
                        is_test_account: true,
                        password: 'foobar'
                    }
                }, function (err, testUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, testUser);
                });
            },

            getUnauthenticatedAppAccessToken: function (cb) {
                getUnauthenticatedAppAccessToken(function (err, accessToken) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken);
                });
            },

            // User starts by testing client
            // while unlogged
            useTestAccount: ['createTestUser', 
                             'deleteAuthorizedClientForUser', 
                             'updateOauthClient', 
                             'getUnauthenticatedAppAccessToken', function (cb, results) {

                var accessToken = results.getUnauthenticatedAppAccessToken;
                var testUser = results.createTestUser;
                var query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: 'registration'
                };

                request(app)
                    .post('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .set('X-Originating-Ip', '127.0.0.1')
                    // We don't use Authorization header
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send({
                        use_test_account: 'true',
                        test_account: testUser.id
                    })
                    .expect(200, function (err, resp) {
                        var isTestAccount = true;
                        var isLoggedUser = false;
                        var respBody = resp.body;

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
            }],

            assertUserCouldRegisterWithTestAccount: ['useTestAccount', function (cb, results) {
                var testUser = results.createTestUser;
                var formData = validFormData(formFieldsMatchingFullScope);

                formData.test_account = testUser.id;

                makeARequest(200, formData, function (err, resp) {
                    var isTestAccount = false;
                    var isLoggedUser = true;

                    if (err) {
                        return done(err);
                    }

                    isValidOauthAuthorizeSuccessRedirect('token', redirectionURI.uri, isTestAccount, 
                                                         isLoggedUser, resp, app, client, 
                                                         function (err, user) {

                        if (err) {
                            return cb(err);
                        }

                        assert.ok(userMatchPassedData(formData, user));

                        cb(null, user);
                    });
                });
            }],

            assertUserStatusWasBound: ['assertUserCouldRegisterWithTestAccount',
                                       function (cb, results) {
                
                var user = results.assertUserCouldRegisterWithTestAccount;

                assert.strictEqual(user.status, 'existing_user_after_test');

                cb(null);
            }],

            assertOauthAuthorizationsWereBound: ['assertUserCouldRegisterWithTestAccount',
                                                 function (cb, results) {

                findOauthAuthorizations.call({
                    findConditions: {
                        'issued_to.client': client.id,
                        'issued_for': user.id
                    }
                }, [], function (err, oauthAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthAuthorizations.length, 2);

                    cb(null);
                })
            }],

            assertOauthEntitiesIDWereBound: ['assertUserCouldRegisterWithTestAccount',
                                             function (cb, results) {
                
                var testUser = results.useTestAccount;
                var user = results.assertUserCouldRegisterWithTestAccount;
                var entities = ['emails', 'phone_numbers', 'addresses'];
                var userMobilePhoneNumber = null;
                var testUserMobilePhoneNumber = null;
                var userLandlinePhoneNumber = null;
                var testUserLandlinePhoneNumber = null;

                assert.strictEqual(user.id, testUser.id);

                assert.strictEqual(user.emails[0].id, testUser.emails[0].id);
                assert.strictEqual(user.addresses[0].id, testUser.addresses[0].id);

                if (user.phone_numbers[0].phone_type === 'mobile') {
                    userMobilePhoneNumber = user.phone_numbers[0];
                    userLandlinePhoneNumber = user.phone_numbers[1];
                } else {
                    userMobilePhoneNumber = user.phone_numbers[1];
                    userLandlinePhoneNumber = user.phone_numbers[0];
                }

                if (testUser.phone_numbers[0].phone_type === 'mobile') {
                    testUserMobilePhoneNumber = testUser.phone_numbers[0];
                    testUserLandlinePhoneNumber = testUser.phone_numbers[1];
                } else {
                    testUserMobilePhoneNumber = testUser.phone_numbers[1];
                    testUserLandlinePhoneNumber = testUser.phone_numbers[0];
                }

                assert.strictEqual(userMobilePhoneNumber.id,
                                   testUserMobilePhoneNumber.id);

                assert.strictEqual(userLandlinePhoneNumber.id,
                                   testUserLandlinePhoneNumber.id);

                cb(null);
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 200 and success redirection '
       + 'when valid form with `code` as response type', function (done) {

        async.auto({
            // Make sure previous tests don't authorize client for user
            deleteAuthorizedClientForUser: function (cb) {
                deleteAuthorizedClientForUser(accessToken, user.id, client.id, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            // Make sure redirection uri scope 
            // contains full scope and code response type
            updateOauthRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: fullScope,
                                            scope_flags: fullScopeFlags, 
                                            response_type: 'code'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }
        }, function (err, results) {
            var formData = validFormData(formFieldsMatchingFullScope);
            
            if (err) {
                return done(err);
            }

            makeARequest(200, formData, function (err, resp) {
                var isTestAccount = false;
                var isLoggedUser = true;

                if (err) {
                    return done(err);
                }

                isValidOauthAuthorizeSuccessRedirect('code', redirectionURI.uri, isTestAccount, 
                                                     isLoggedUser, resp, app, client, function (err, user) {

                    if (err) {
                        return done(err);
                    }

                    assert.ok(userMatchPassedData(formData, user));

                    done();
                });
            });
        });
    });

    it('responds with HTTP code 200 and success redirection '
       + 'when valid form with `token` as response type', function (done) {

        async.auto({
            // Make sure previous tests doesn't authorize client for user
            deleteAuthorizedClientForUser: function (cb) {
                deleteAuthorizedClientForUser(accessToken, user.id, client.id, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            // Make sure redirection uri scope 
            // contains full scope and token response type
            updateOauthRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: fullScope,
                                            scope_flags: fullScopeFlags, 
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }
        }, function (err, results) {
            var formData = validFormData(formFieldsMatchingFullScope);
            
            if (err) {
                return done(err);
            }

            makeARequest(200, formData, function (err, resp) {
                var isTestAccount = false;
                var isLoggedUser = true;

                if (err) {
                    return done(err);
                }

                isValidOauthAuthorizeSuccessRedirect('token', redirectionURI.uri, isTestAccount, 
                                                     isLoggedUser, resp, app, client, function (err, user) {

                    if (err) {
                        return done(err);
                    }

                    assert.ok(userMatchPassedData(formData, user));

                    done();
                });
            });
        });
    });
});