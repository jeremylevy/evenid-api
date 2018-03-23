var assert = require('assert');
var Type = require('type-of-is');
var request = require('supertest');

var querystring = require('querystring');
var mongoose = require('mongoose');
var async = require('async');

var config = require('../../../../../config');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

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

describe('POST /oauth/authorize (Unlogged user) (Login)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            oauthAuthBeforeHookResp = resp;
            app = resp.app;
            accessToken = resp.accessToken;
            user = resp.user;
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            updateOauthRedirectionURI = updateOauthRedirectionURI(app);

            makeARequest = function (statusCode, data, done) {
                var cb = function (err, accessToken) {
                    var flow = 'login';
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
                                return done(err);
                            }

                            resp = res.body;

                            done(null, resp);
                        });
                };
                
                getUnauthenticatedAppAccessToken(cb);
            };
            
            done();
        });
    });

    it('responds with HTTP code 200 and '
       + '`redirect_to_registration_flow` step '
       + 'reply when unregistered user try to login', function (done) {
        
        makeARequest(200, {
            email: user.email,
            password: user.password
        }, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.step, 'redirect_to_registration_flow');
            assert.strictEqual(resp.clientName, client.name);

            done();
        });
    });

    // Don't check for invalid email because
    // invalid email equals user not registered
    // equals registration during oauth authorize flow
    it('responds with HTTP code 400 and `invalid_grant` '
       + 'error when invalid password', function (done) {
       
        makeARequest(400, {
            email: user.email,
            // Password is not known so make sure good password
            // was not sent unintentionally by passing unique value
            password: mongoose.Types.ObjectId().toString()
        }, function (err, resp) {
            if (err) {
                return done(err);
            }

            // Same error than during 
            // token password grant type
            assert.strictEqual(Object.keys(resp).length, 3);
            
            assert.strictEqual(resp.error, 'invalid_grant');

            assert.strictEqual(resp.invalid_email, false);
            assert.strictEqual(resp.invalid_password, true);

            done();
        });
    });

    it('responds with HTTP code 200 and success '
       + 'redirect with code when user has no missing '
       + 'authorizations and response type equals code', function (done) {
        
        // User authorize email access for client
        getOauthClientAccessToken.call({
            oauthAuthBeforeHookResp: oauthAuthBeforeHookResp,
            redirectionURIScope: ['emails'], 
            redirectionURIScopeFlags: [],
            redirectionURIResponseType: 'code'
        }, function (err, resp) {

            if (err) {
                return done(err);
            }

            makeARequest(200, {
                email: user.email,
                password: user.password
            }, function (err, resp) {
                if (err) {
                    return done(err);
                }

                // `false`: is test account?
                // `false`: is logged user?
                isValidOauthAuthorizeSuccessRedirect('code', 
                                                     redirectionURI.uri, 
                                                     false, false, 
                                                     resp, app, client, done);
            });
        });
    });

    it('responds with HTTP code 200 and success redirect with token '
       + 'when user has no missing authorizations and response type equals token', function (done) {
        
        // Client were authorized by previous test
        // don't try to authorize again, it will be redirected to login
        // flow by trying to post again on registration flow
        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {response_type: 'token'}, function (err) {
            
            if (err) {
                return done(err);
            }

            makeARequest(200, {
                email: user.email,
                password: user.password
            }, function (err, resp) {
                if (err) {
                    return done(err);
                }

                // `false`: is test account?
                // `false`: is logged user?
                isValidOauthAuthorizeSuccessRedirect('token', 
                                                     redirectionURI.uri, 
                                                     false, false, 
                                                     resp, app, client, done);
            });
        });
    });
    
    it('responds with HTTP code 200 and `redirect` step reply '
       + 'with `same` as `redirectTo` when user has missing authorizations', function (done) {
        
        var newScope = config.EVENID_OAUTH.VALID_USER_SCOPE.filter(function (scopeValue) {
            // We have billing/shipping address and mobile/landline number in scope
            // So don't keep base value
            return ['address', 'phone_number'].indexOf(scopeValue) === -1;
        });

        // No test account involved here
        var testAccountCookieMustBeDeleted = false;

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {scope: newScope.join(' ')}, function (err) {

            if (err) {
                return done(err);
            }

            makeARequest(200, {
                email: user.email,
                password: user.password
            }, function (err, resp) {
                if (err) {
                    return done(err);
                }

                isValidOauthAuthorizeSameRedirect(testAccountCookieMustBeDeleted,
                                                  resp);
                
                done();
            });
        });
    });
});