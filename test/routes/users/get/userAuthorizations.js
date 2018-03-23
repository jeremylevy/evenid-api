var assert = require('assert');
var request = require('supertest');

var async = require('async');
var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var compareArray = require('../../../../testUtils/lib/compareArray');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var oauthAuthorizeBeforeHook = require('../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;
    
describe('GET /users/:user_id/authorizations', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, userID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/users/' + userID 
                             + '/authorizations' 
                             + (this.queryString || ''))
                        .set('Authorization', authHeader)
                        .expect('Content-Type', 'application/json; charset=utf-8')
                        .expect('Cache-Control', 'no-store')
                        .expect('Pragma', 'no-cache')
                        .expect(body)
                        .expect(statusCode, function (err, resp) {
                            if (err) {
                                return done(err);
                            }

                            assert.doesNotThrow(function () {
                                JSON.parse(resp.text);
                            });

                            done(null, resp);
                        });
                }.bind(this);

                if (this.userID) {
                    return cb(null, this.accessToken, this.userID);
                }

                getOauthClientAccessToken(function (err, resp) {
                    cb(null, resp.accessToken, resp.user.id);
                });
            };

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: resp.appAccessToken,
                authHeader: 'Bearer  ' + resp.appAccessToken,
                userID: resp.user.id
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: resp.user.id
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(resp.appAccessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: resp.appAccessToken,
                    userID: resp.user.id
                }, 400, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(resp.appAccessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: resp.appAccessToken,
                    userID: resp.user.id
                }, 400, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to get user authorizations', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: resp.user.id
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to get authorizations of another user', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: resp.user.id
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 200 and user authorizations '
       + 'when valid request', function (done) {

        // Authorize client for user
        getOauthClientAccessToken(function (err, getOauthClientAccessTokenResp) {
            // Positive lookahead assertion - Negative lookahead assertion
            var reg = new RegExp('^\\[\\{'
                                 + '(?=.*client)(?=.*id)(?=.*name)'
                                 + '(?=.*user)'
                                 + '(?=.*entities)(?=.*addresses)'
                                 + '(?=.*phone_numbers)(?=.*emails)'
                                 + '(?=.*scope)(?=.*scope_flags)(?=.*email)'
                                 + '(?=.*first_name)(?=.*last_name)'
                                 + '(?=.*nickname)(?=.*profil_photo)'
                                 + '(?=.*gender)(?=.*date_of_birth)'
                                 + '(?=.*nationality)(?=.*timezone)'
                                 + '(?=.*addresses)(?=.*phone_numbers)'
                                 + '(?!.*"_id")(?!.*"__v")'
                                 + '(?!.*"client_id")(?!.*"client_secret")');

            if (err) {
                return done(err);
            }

            makeARequest.call({
                // Access is restricted to app access tokens
                accessToken: getOauthClientAccessTokenResp.appAccessToken,
                userID: getOauthClientAccessTokenResp.user.id
            }, 200, reg, function (err, resp) {
                var authorizations = resp.body;

                if (err) {
                    return done(err);
                }

                assert.ok(Type.is(authorizations, Array),
                          authorizations.length > 0);

                authorizations.forEach(function (authorization) {
                    assert.ok(areValidObjectIDs([authorization.id]));
                    assert.ok(areValidObjectIDs([authorization.user]));
                    assert.ok(areValidObjectIDs([authorization.client.id]));

                    assert.ok(Type.is(authorization.client.name, String)
                              && authorization.client.name.length > 0);

                    assert.ok(Type.is(authorization.scope, Array)
                              && compareArray(authorization.scope, 
                                              getOauthClientAccessTokenResp.fullScope));

                    // May be empty
                    assert.ok(Type.is(authorization.scope_flags, Array)
                              && compareArray(authorization.scope_flags, 
                                              getOauthClientAccessTokenResp.fullScopeFlags));

                    assert.ok(Type.is(authorization.entities, Object)
                              && Object.keys(authorization.entities).length === 3);

                    /* May be empty */
                    assert.ok(Type.is(authorization.entities.emails, Array));
                    assert.ok(Type.is(authorization.entities.phone_numbers, Array));
                    assert.ok(Type.is(authorization.entities.addresses, Array));
                });

                done();
            });
        });
    });
    
    it('responds with HTTP code 200 and user authorizations '
       + 'when valid entity/entity_id parameter', function (done) {

        var defaultCallback = function (cb) {
            return function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            };
        };

        async.auto({
            createFirstClient: function (cb) {
                oauthAuthorizeBeforeHook(defaultCallback(cb));
            },

            createSecondClient: ['createFirstClient', function (cb, results) {
                var createFirstClientResp = results.createFirstClient;

                oauthAuthorizeBeforeHook.call({
                    // We need to authorize multiple clients for SAME user
                    // so always use the same access token and user property
                    accessToken: createFirstClientResp.accessToken,
                    user: createFirstClientResp.user
                }, defaultCallback(cb));
            }],

            createThirdClient: ['createFirstClient', function (cb, results) {
                var createFirstClientResp = results.createFirstClient;

                oauthAuthorizeBeforeHook.call({
                    // Same than above
                    accessToken: createFirstClientResp.accessToken,
                    user: createFirstClientResp.user
                }, defaultCallback(cb));
            }],

            createFourthClient: ['createFirstClient', function (cb, results) {
                var createFirstClientResp = results.createFirstClient;

                oauthAuthorizeBeforeHook.call({
                    // Same than above
                    accessToken: createFirstClientResp.accessToken,
                    user: createFirstClientResp.user
                }, defaultCallback(cb));
            }],

            // Create user addresses which will be used as reference
            authorizeFirstClient: ['createFirstClient', function (cb, results) {
                var createFirstClientResp = results.createFirstClient;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: createFirstClientResp,
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: ['separate_shipping_billing_address']
                }, defaultCallback(cb));
            }],

            authorizeSecondClient: ['authorizeFirstClient', 'createSecondClient', function (cb, results) {
                var createSecondClientResp = results.createSecondClient;
                var authorizeFirstClientResp = results.authorizeFirstClient;
                var validFormData = createSecondClientResp.validFormData

                // Authorize only the first user address
                // to assert that addresses are shared 
                // for all clients which have asked for them
                createSecondClientResp.validFormData = function () {
                    return {
                        address: authorizeFirstClientResp.user.addresses[0].id
                    };
                };

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: createSecondClientResp,
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: []
                }, defaultCallback(cb));
            }],

            authorizeThirdClient: ['authorizeFirstClient', 'createThirdClient', function (cb, results) {
                var createThirdClientResp = results.createThirdClient;
                var authorizeFirstClientResp = results.authorizeFirstClient;
                var validFormData = createThirdClientResp.validFormData

                // Authorize the two user addresses
                createThirdClientResp.validFormData = function () {
                    return {
                        shipping_address: authorizeFirstClientResp.user.addresses[0].id,
                        billing_address: authorizeFirstClientResp.user.addresses[1].id
                    };
                };

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: createThirdClientResp,
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: ['separate_shipping_billing_address']
                }, defaultCallback(cb));
            }],

            // Doesn't authorize addresses
            authorizeFourthClient: ['createFourthClient', function (cb, results) {
                var createFourthClientResp = results.createFourthClient;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: createFourthClientResp,
                    redirectionURIScope: ['nickname', 'gender'],
                    redirectionURIScopeFlags: []
                }, defaultCallback(cb));
            }]
        }, function (err, results) {
            var resp = results && results.authorizeFirstClient;

            if (err) {
                return done(err);
            }

            async.auto({
                assertWithoutEntityParam: function (cb) {
                    makeARequest.call({
                        // Access is restricted to app access tokens
                        accessToken: resp.appAccessToken,
                        userID: resp.user.id
                    }, 200, /.+/, function (err, resp) {
                        var body = resp && resp.body;

                        if (err) {
                            return cb(err);
                        }

                        // All created clients
                        assert.strictEqual(body.length, 4);

                        cb();
                    });
                },

                assertWithEntityParam: function (cb) {
                    makeARequest.call({
                        // Access is restricted to app access tokens
                        accessToken: resp.appAccessToken,
                        userID: resp.user.id,
                        queryString: '?entity=addresses'
                    }, 200, /.+/, function (err, resp) {
                        var body = resp && resp.body;

                        if (err) {
                            return cb(err);
                        }

                        // Fourth client doesn't authorize address
                        assert.strictEqual(body.length, 3);

                        cb();
                    });
                },

                assertWithEntityIDParam: function (cb) {
                    makeARequest.call({
                        // Access is restricted to app access tokens
                        accessToken: resp.appAccessToken,
                        userID: resp.user.id,
                        queryString: '?entity=addresses&entity_id=' + resp.user.addresses[1].id
                    }, 200, /.+/, function (err, resp) {
                        var body = resp && resp.body;

                        if (err) {
                            return cb(err);
                        }

                        // Addresses are shared for all clients
                        // which have asked for them
                        assert.strictEqual(body.length, 3);

                        cb();
                    });
                }
            }, function (err, results) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });
});