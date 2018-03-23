var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var mongoose = require('mongoose');

var async = require('async');

var createUser = require('../../../../../testUtils/db/createUser');
var findUsers = require('../../../../../testUtils/db/findUsers');

var updateOauthClient = require('../../../../../testUtils/clients/update');
var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var isInvalidRequestError = require('../../../../../testUtils/validators/isInvalidRequestError');

var isValidOauthAuthorizeSameRedirect = require('../../../../../testUtils/validators/isValidOauthAuthorizeSameRedirect');
var isValidOauthAuthorizeSuccessRedirect = require('../../../../../testUtils/validators/isValidOauthAuthorizeSuccessRedirect');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var oauthAuthBeforeHookResp = null;

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

var fullScope = null;
var fullScopeFlags = null;

var passTestAccount = function (scope, responseType, cb) {
    async.auto({
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

        updateOauthRedirectionURI: function (cb) {
            updateOauthRedirectionURI(accessToken, 
                                      client.id,
                                      redirectionURI.id,
                                      {scope: scope.join(' '), 
                                       response_type: responseType}, 
                                      function (err, oauthRedirectionURI) {

                if (err) {
                    return cb(err);
                }

                cb(null, oauthRedirectionURI);
            });
        },

        createTestUser: function (cb) {
            createUser.call({
                user: {
                    is_test_account: true
                }
            }, function (err, testUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, testUser);
            });
        }
    }, function (err, results) {
        var testUser = results.createTestUser;

        if (err) {
            return cb(err);
        }

        makeARequest(200, {
            email: mongoose.Types.ObjectId().toString() + '@evenid.com',
            password: 'foobar',
            test_account: testUser.id
        }, function (err, resp) {
            if (err) {
                return cb(err);
            }
            
            cb(null, {
                response: resp,
                testUser: testUser
            });
        });
    });
};

var testWithVariousScopeAndResponseType = function (scope, scopeFlags, responseType, cb) {
    var context = this;

    var update = {
        scope: scope, 
        scope_flags: scopeFlags, 
        response_type: responseType
    };

    updateOauthRedirectionURI(accessToken, 
                              client.id,
                              redirectionURI.id,
                              update, function (err) {
        
        if (err) {
            return cb(err);
        }

        makeARequest(200, context.user || {
            email: mongoose.Types.ObjectId().toString() + '@evenid.com',
            password: 'foobar'
        }, function (err, resp) {
            if (err) {
                return cb(err);
            }

            cb(null, resp);
        });
    });
};

describe('POST /oauth/authorize (Unlogged user) (Register)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            var getAppAccessToken = null;

            if (err) {
                return done(err);
            }

            oauthAuthBeforeHookResp = resp;
            app = resp.app;
            accessToken = resp.accessToken;
            user = resp.user;
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            fullScope = resp.fullScope;
            fullScopeFlags = resp.fullScopeFlags;

            getAppAccessToken = function (cb) {
                cb(null, accessToken, user);
            };

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            updateOauthClient = updateOauthClient(app);

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);
            deleteAuthorizedClientForUser = deleteAuthorizedClientForUser(app);

            makeARequest = function (statusCode, data, done) {
                var cb = function (err, accessToken) {
                    var context = this;

                    var req = null;
                    var flow = 'registration';
                    var query = null;

                    if (err) {
                        return done(err);
                    }

                    query = {
                        client_id: client.client_id.toString(),
                        redirect_uri: redirectionURI.uri,
                        state: 'foo',
                        flow: flow
                    };

                    req = request(app)
                            .post('/oauth/authorize?' + querystring.stringify(query))
                            .set('Authorization', 'Bearer ' + accessToken)
                            .set('Content-Type', 'application/x-www-form-urlencoded');

                    if (!context.noIPHeader) {
                        req.set('X-Originating-Ip',
                                context.IPHeader || '127.0.0.1');
                    }

                    req.send(data)
                       .expect(statusCode, function (err, res) {
                            var resp = null;

                            if (err) {
                                return done(err);
                            }

                            resp = res.body;

                            done(null, resp);
                        });
                }.bind(this);

                getUnauthenticatedAppAccessToken(cb);
            };
            
            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when no IP header was sent', function (done) {
        
        makeARequest.call({
            noIPHeader: true
        }, 400, {
            email: 'foo@evenid.com',
            password: 'foobar'
        }, function (err, resp) {
            var error = resp && resp.error;

            if (err) {
                return done(err);
            }

            // `['X-Originating-IP']`: message properties
            isInvalidRequestError(error, ['X-Originating-IP']);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid IP header was sent', function (done) {
        
        makeARequest.call({
            IPHeader: 'bar'
        }, 400, {
            email: 'foo@evenid.com',
            password: 'foobar'
        }, function (err, resp) {
            var error = resp && resp.error;

            if (err) {
                return done(err);
            }

            // `['X-Originating-IP']`: message properties
            isInvalidRequestError(error, ['X-Originating-IP']);

            done();
        });
    });

    it('responds with HTTP code 200 and `redirect_to_login_flow` step '
       + 'reply when registered user try to register once again', function (done) {
        
        // User authorize access to client
        getOauthClientAccessToken.call({
            oauthAuthBeforeHookResp: oauthAuthBeforeHookResp
        }, function (err, resp) {
            var user = resp && resp.user;
            var appAccessToken = resp && resp.appAccessToken;
            
            if (err) {
                return done(err);
            }

            // User try to register once again
            makeARequest(200, {
                email: user.email,
                password: user.password
            }, function (err, resp) {
                
                if (err) {
                    return done(err);
                }

                assert.strictEqual(resp.step, 'redirect_to_login_flow');
                
                assert.strictEqual(resp.clientName, client.name);

                // Back to unregistered user
                deleteAuthorizedClientForUser(appAccessToken, user.id, client.id, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid email', function (done) {
        
        makeARequest(400, {
            email: 'foo',
            password: 'foobar'
        }, function (err, resp) {
            var error = resp.error;

            if (err) {
                return done(err);
            }

            // `['email']`: message properties
            isInvalidRequestError(error, ['email']);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid password', function (done) {
        
        makeARequest(400, {
            email: 'foo' + mongoose.Types.ObjectId().toString() + '@evenid.com',
            password: 'bar'
        }, function (err, resp) {
            var error = resp.error;

            if (err) {
                return done(err);
            }

            // `['password']`: message properties
            isInvalidRequestError(error, ['password']);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when invalid emails and password', function (done) {
        
        makeARequest(400, {
            email: 'foo',
            password: 'bar'
        }, function (err, resp) {
            var error = resp.error;

            if (err) {
                return done(err);
            }

            // `['email', 'password']`: message properties
            isInvalidRequestError(error, ['email', 'password']);

            done();
        });
    });

    it('responds with HTTP code 200 and `redirect` step reply '
       + 'when timezone was set and valid', function (done) {

        // No test account involved here
        var testAccountCookieMustBeDeleted = false;

        var timezone = 'Europe/Paris';

        // Response type does not matter here
        testWithVariousScopeAndResponseType.call({
            user: {
                email: mongoose.Types.ObjectId().toString() + '@evenid.com',
                password: 'foobar',
                timezone: timezone
            }
        }, fullScope, fullScopeFlags, 'token', function (err, resp) {
            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSameRedirect(testAccountCookieMustBeDeleted,
                                              resp);

            findUsers([resp.accessToken.user_id], function (err, users) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(users.length, 1);

                assert.strictEqual(users[0].timezone, timezone);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and `redirect` step reply '
       + 'when timezone was set and invalid', function (done) {

        // No test account involved here
        var testAccountCookieMustBeDeleted = false;

        // Response type does not matter here
        testWithVariousScopeAndResponseType.call({
            user: {
                email: mongoose.Types.ObjectId().toString() + '@evenid.com',
                password: 'foobar',
                timezone: 'bar'
            }
        }, fullScope, fullScopeFlags, 'token', function (err, resp) {
            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSameRedirect(testAccountCookieMustBeDeleted,
                                              resp);

            findUsers([resp.accessToken.user_id], function (err, users) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(users.length, 1);

                assert.strictEqual(users[0].timezone, undefined);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and `redirect` step reply '
       + 'with `same` as `redirectTo` when user '
       + 'has missing authorizations', function (done) {

        // No test account involved here
        var testAccountCookieMustBeDeleted = false;

        // Response type does not matter here
        testWithVariousScopeAndResponseType(fullScope, fullScopeFlags, 
                                            'token', function (err, resp) {
            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSameRedirect(testAccountCookieMustBeDeleted,
                                              resp);

            done();
        });
    });

    it('responds with HTTP code 200 and `redirect` step reply '
       + 'with `same` as `redirectTo` and register user with passed '
       + 'test account id when user has missing authorizations', function (done) {

        // Make sure it was deleted 
        // once test account was merged with user
        var testAccountCookieMustBeDeleted = true;

        // Response type does not matter here
        passTestAccount(fullScope, 'code', function (err, results) {
            var resp = null;
            var testUser = null;

            if (err) {
                return done(err);
            }

            resp = results.response;
            testUser = results.testUser;

            isValidOauthAuthorizeSameRedirect(testAccountCookieMustBeDeleted,
                                              resp);

            // Make sure test account was used
            assert.strictEqual(resp.accessToken.user_id, testUser.id);
            
            done();
        });
    });

    it('responds with HTTP code 200 and success redirect with code '
       + 'when user has no missing authorizations '
       + 'and response type equals code', function (done) {
        
        var scopeFlags = [];

        testWithVariousScopeAndResponseType(['emails'], scopeFlags, 
                                            'code', function (err, resp) {
            if (err) {
                return done(err);
            }

            // `false`: is test account?
            // `false`: is logged user?
            isValidOauthAuthorizeSuccessRedirect('code', redirectionURI.uri, 
                                                 false, false, 
                                                 resp, app, client, done);
        });
    });

    it('responds with HTTP code 200 and success redirect with token '
       + 'when user has no missing authorizations '
       + 'and response type equals token', function (done) {

        var scopeFlags = [];

        testWithVariousScopeAndResponseType(['emails'], scopeFlags, 
                                            'token', function (err, resp) {
            
            if (err) {
                return done(err);
            }

            // `false`: is test account?
            // `false`: is logged user?
            isValidOauthAuthorizeSuccessRedirect('token', redirectionURI.uri, 
                                                 false, false, 
                                                 resp, app, client, done);
        });
    });

    it('responds with HTTP code 200, success redirect with code '
       + 'and register user with passed test account ID '
       + 'when user has no missing authorizations and '
       + 'response type equals code', function (done) {
       
        passTestAccount(['emails'], 'code', function (err, results) {
            var resp = null;
            var testUser = null;

            if (err) {
                return done(err);
            }

            resp = results.response;
            testUser = results.testUser;

            // Make sure test user was used
            assert.strictEqual(resp.accessToken.user_id, testUser.id);

            // `false`: is test account?
            // `false`: is logged user?
            isValidOauthAuthorizeSuccessRedirect('code', redirectionURI.uri, 
                                                 false, false, 
                                                 resp, app, client, done);
        });
    });

    it('responds with HTTP code 200, success redirect with token '
       + 'and register user with passed test account ID '
       + 'when user has no missing authorizations '
       + 'and response type equals token', function (done) {
       
        passTestAccount(['emails'], 'token', function (err, results) {
            var resp = null;
            var testUser = null;

            if (err) {
                return done(err);
            }

            resp = results.response;
            testUser = results.testUser;

            assert.strictEqual(resp.accessToken.user_id, testUser.id);

            // `false`: is test account?
            // `false: is logged user?
            isValidOauthAuthorizeSuccessRedirect('token', redirectionURI.uri, 
                                                 false, false, 
                                                 resp, app, client, done);
        });
    });
});