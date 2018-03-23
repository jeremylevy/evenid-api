var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var oauthAuthorizeBeforeHook = require('./oauthAuthorizeBeforeHook');

var GetUnauthenticatedAppAccessToken = require('../getUnauthenticatedAppAccessToken');
var getOauthClientAccessToken = require('../getOauthClientAccessToken');

var UpdateOauthClient = require('../clients/update');
var UpdateRedirectionURI = require('../clients/updateRedirectionURI');

var createUser = require('../db/createUser');

var isAccessDeniedError = require('../validators/isAccessDeniedError');
var isInvalidRequestError = require('../validators/isInvalidRequestError');
var isValidOauthAuthorizeSuccessRedirect = require('../validators/isValidOauthAuthorizeSuccessRedirect');

module.exports = function (useLoggedUser) {
    var getUnauthenticatedAppAccessToken = null;

    var updateOauthClient = null;
    var updateRedirectionURI = null;

    var makeARequest = null;
    var app = null;

    var oauthAuthorizeBeforeHookResp = null;

    var client = null;
    var redirectionURI = null;

    var fullScope = null;
    var fullScopeFlags = null;

    var accessToken = null;
    var user = null;

    var assertTestUserIsValid = null;

    var checkPassedTestAccount = function (scope, scopeFlags, responseType, 
                                           isTestAccount, statusCode, cb) {
        
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

            updateRedirectionURIScope: function (cb) {
                if (!scope) {
                    return cb(null);
                }

                updateRedirectionURI(accessToken, 
                                     client.id,
                                     redirectionURI.id, {
                                        scope: scope,
                                        scope_flags: scopeFlags,
                                        response_type: responseType
                                     }, function (err, oauthRedirectionURI) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURI);
                });
            },

            createTestUser: function (cb) {
                createUser.call({
                    user: {
                        is_test_account: !!isTestAccount,
                        password: 'foobar'
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

            makeARequest(statusCode, {
                use_test_account: 'true',
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

    var testWithVariousScope = function (scope, scopeFlags, responseType, done) {
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

            updateRedirectionURIScope: function (cb) {
                updateRedirectionURI(accessToken, 
                                     client.id,
                                     redirectionURI.id, {
                                        scope: scope,
                                        scope_flags: scopeFlags,
                                        response_type: responseType
                                     }, function (err, oauthRedirectionURI) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURI);
                });
            }
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            makeARequest(200, {
                use_test_account: 'true'
            }, function (err, resp) {
                var isTestAccount = true;

                if (err) {
                    return done(err);
                }

                isValidOauthAuthorizeSuccessRedirect(responseType, redirectionURI.uri, isTestAccount, 
                                                     useLoggedUser, resp, app, client,
                                                     function (err, testUser) {

                    if (err) {
                        return done(err);
                    }

                    assertTestUserIsValid(scope, scopeFlags, testUser);

                    done();
                });
            });
        });
    };

    var testDesc = 'POST /oauth/authorize (Unlogged user) (Use test account) (Success)';

    if (useLoggedUser) {
        testDesc = 'POST /oauth/authorize (Logged user) (Use test account) (Success)';
    }

    describe(testDesc, function () {
        before(function (done) {
            oauthAuthorizeBeforeHook(function (err, resp) {
                if (err) {
                    return done(err);
                }

                oauthAuthorizeBeforeHookResp = resp;
                app = resp.app;
                accessToken = resp.accessToken;
                user = resp.user;
                client = resp.client;
                redirectionURI = resp.redirectionURI;
                assertTestUserIsValid = resp.assertTestUserIsValid;
                fullScope = resp.fullScope;
                fullScopeFlags = resp.fullScopeFlags;

                getUnauthenticatedAppAccessToken = GetUnauthenticatedAppAccessToken(app);

                updateOauthClient = UpdateOauthClient(app);
                updateRedirectionURI = UpdateRedirectionURI(app);

                makeARequest = function (statusCode, data, done) {
                    var cb = function (err, accessToken) {
                        var context = this;
                        var flow = 'login';
                        var query = null;

                        query = {
                            client_id: (context.client || client).client_id.toString(),
                            redirect_uri: (context.redirectionURI || redirectionURI).uri,
                            state: 'foo',
                            flow: flow
                        };

                        request(app)
                            .post('/oauth/authorize?' + querystring.stringify(query))
                            .set('X-Originating-Ip', '127.0.0.1')
                            .set('Authorization', 'Bearer ' + (context.accessToken || accessToken))
                            .set('Content-Type', 'application/x-www-form-urlencoded')
                            .send(data)
                            .expect(statusCode, function (err, res) {
                                var resp = null;

                                if (err) {
                                    return done(err);
                                }

                                resp = res.body;

                                done(null, resp);
                            });
                    }.bind(this);

                    if (useLoggedUser) {
                        return cb(null, accessToken);
                    }

                    getUnauthenticatedAppAccessToken(cb);
                };
                
                done();
            });
        });

        it('responds with HTTP code 200 for full '
           + 'scope and `code` response type', function (done) {

            testWithVariousScope(fullScope, fullScopeFlags, 'code', done);
        });

        it('responds with HTTP code 200 for full '
           + 'scope and `token` response type', function (done) {

            testWithVariousScope(fullScope, fullScopeFlags, 'token', done);
        });

        /* Response type does not matter
           Already tested above */

        it('responds with HTTP code 200 for unknown phone '
           + 'number scope after mobile and landline scope', function (done) {

            var scope = ['phone_numbers'];
            var scopeFlags = ['mobile_phone_number', 'landline_phone_number'];

            testWithVariousScope(scope, scopeFlags, 'code', function (err, resp) {
                if (err) {
                    return done(err);
                }

                testWithVariousScope(['phone_numbers'], [], 'code', done);
            });
        });

        it('responds with HTTP code 200 for mobile and '
           + 'landline phone number scope after unknown phone scope', function (done) {

            var scope = ['phone_numbers'];
            var scopeFlags = [];

            testWithVariousScope(scope, scopeFlags, 'code', function (err, resp) {
                if (err) {
                    return done(err);
                }

                testWithVariousScope(['phone_numbers'], [
                    'mobile_phone_number',
                    'landline_phone_number'
                ], 'code', done);
            });
        });

        it('responds with HTTP code 200 '
           + 'for unknown phone number scope', function (done) {

            testWithVariousScope(['phone_numbers'], [], 'code', done);
        });

        it('responds with HTTP code 200 '
           + 'for unknown address scope', function (done) {

            testWithVariousScope(['addresses'], [], 'code', done);
        });

        /* END */

        it('responds with HTTP code 200 and success redirect '
           + 'when client authorize test accounts and test '
           + 'account was passed', function (done) {

            var responseType = 'code';
            var isTestAccount = true;
            var expectedStatusCode = 200;

            checkPassedTestAccount(fullScope, fullScopeFlags, responseType,
                                   isTestAccount, expectedStatusCode,
                                   function (err, checkReturn) {
                
                var testUser = null;
                var resp = null;

                if (err) {
                    return done(err);
                }

                testUser = checkReturn.testUser;
                resp = checkReturn.response;

                // If user was logged, test account was not used
                // Used user is access token user
                if (useLoggedUser) {
                    assert.strictEqual(resp.userID, user.id);
                } else {
                    assert.strictEqual(resp.userID, testUser.id);
                }

                isValidOauthAuthorizeSuccessRedirect(responseType, redirectionURI.uri, isTestAccount, 
                                                     useLoggedUser, resp, app, client,
                                                     function (err, testUser) {

                    if (err) {
                        return done(err);
                    }

                    assertTestUserIsValid(fullScope, fullScopeFlags, testUser);

                    done();
                });
            });      
        });
    });
};