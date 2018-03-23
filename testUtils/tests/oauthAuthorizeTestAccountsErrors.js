var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var oauthAuthorizeBeforeHook = require('./oauthAuthorizeBeforeHook');

var GetUnauthenticatedAppAccessToken = require('../getUnauthenticatedAppAccessToken');
var getOauthClientAccessToken = require('../getOauthClientAccessToken');

var UpdateOauthClient = require('../clients/update');

var createUser = require('../db/createUser');

var isAccessDeniedError = require('../validators/isAccessDeniedError');
var isInvalidRequestError = require('../validators/isInvalidRequestError');
var isValidOauthAuthorizeSuccessRedirect = require('../validators/isValidOauthAuthorizeSuccessRedirect');

module.exports = function (useLoggedUser) {
    var getUnauthenticatedAppAccessToken = null;

    var updateOauthClient = null;

    var makeARequest = null;
    var app = null;

    var oauthAuthorizeBeforeHookResp = null;

    var client = null;
    var redirectionURI = null;

    var accessToken = null;
    var user = null;

    var checkPassedTestAccount = function (isTestAccount, statusCode, cb) {
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

    var testDesc = 'POST /oauth/authorize (Unlogged user) (Use test account) (Errors)';

    if (useLoggedUser) {
        testDesc = 'POST /oauth/authorize (Logged user) (Use test account) (Errors)';
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

                getUnauthenticatedAppAccessToken = GetUnauthenticatedAppAccessToken(app);
                updateOauthClient = UpdateOauthClient(app);

                makeARequest = function (statusCode, data, done) {
                    var cb = function (err, accessToken) {
                        var context = this;

                        var req = null;
                        var flow = 'login';
                        var query = null;

                        if (err) {
                            return done(err);
                        }

                        query = {
                            client_id: (context.client || client).client_id.toString(),
                            redirect_uri: (context.redirectionURI || redirectionURI).uri,
                            state: 'foo',
                            flow: flow
                        };

                        req = request(app)
                                .post('/oauth/authorize?' + querystring.stringify(query))
                                .set('Authorization', 'Bearer ' + (context.accessToken || accessToken))
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

                    if (useLoggedUser) {
                        return cb(null, accessToken);
                    }

                    getUnauthenticatedAppAccessToken(cb);
                };
                
                done();
            });
        });
        
        // When test user was created we need
        // IP address for event count and ReCaptcha
        if (!useLoggedUser) {
            it('responds with HTTP code 400 and `invalid_request` '
               + 'error when no IP header was sent', function (done) {
                
                makeARequest.call({
                    noIPHeader: true
                }, 400, {
                    use_test_account: true
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
                    use_test_account: true
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
        }

        it('responds with HTTP code 403 and `access_denied` error '
           + 'when client does not authorize test accounts', function (done) {

            updateOauthClient(accessToken, 
                              client.id, 
                              {authorize_test_accounts: 'false'}, 
                              function (err, oauthClient) {

                makeARequest(403, {
                    use_test_account: 'true'
                }, function (err, resp) {
                    var error = resp.error;

                    if (err) {
                        return done(err);
                    }

                    isAccessDeniedError(error);

                    done();
                });
            });
        });

        it('responds with HTTP code 400 and `invalid_request` error '
           + 'when client authorize test accounts and passed account '
           + 'was not a valid ObjectID', function (done) {

            updateOauthClient(accessToken, 
                              client.id, 
                              {authorize_test_accounts: 'true'}, 
                              function (err, oauthClient) {

                if (err) {
                    return cb(err);
                }

                makeARequest(400, {
                    use_test_account: 'true',
                    test_account: 'foo'
                }, function (err, resp) {
                    var error = resp && resp.error;

                    if (err) {
                        return done(err);
                    }

                    isInvalidRequestError(error, ['test_account']);

                    done();
                }); 
            });
        });

        it('responds with HTTP code 403 and `access_denied` error '
           + 'when client authorize test accounts and passed account '
           + 'was not test account', function (done) {

            var isTestAccount = false;
            var expectedStatusCode = 403;

            checkPassedTestAccount(isTestAccount, expectedStatusCode, 
                                   function (err, checkReturn) {
                var resp = null;

                if (err) {
                    return done(err);
                }

                resp = checkReturn.response;

                isAccessDeniedError(resp.error);

                done();
            });      
        });
    
        if (useLoggedUser) {
            it('responds with HTTP code 403 and `access_denied` error '
               + 'when user try to use test account while registered' , function (done) {

                getOauthClientAccessToken(function (err, resp) {
                    if (err) {
                        return done(err);
                    } 

                    makeARequest.call({
                        client: resp.client,
                        redirectionURI: resp.redirectionURI,
                        // Oauth authorize methods needs to be 
                        // called with app access token
                        // not client access token. 
                        // (checkScope('app') was used on all logged methods)
                        accessToken: resp.appAccessToken
                    }, 403, {
                        use_test_account: 'true'
                    }, function (err, resp) {
                        var error = resp && resp.error;

                        if (err) {
                            return done(err);
                        }

                        isAccessDeniedError(error);

                        done();
                    });
                });
            });
        }
    });
};