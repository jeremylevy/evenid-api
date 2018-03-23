var assert = require('assert');
var request = require('supertest');

var async = require('async');

var config = require('../../../config');

var createHash = require('../../../libs/createHash');

var getOauthClientAccessToken = require('../../../testUtils/getOauthClientAccessToken');

var findOauthAuthorizations = require('../../../testUtils/db/findOauthAuthorizations');
var findOauthAccessTokens = require('../../../testUtils/db/findOauthAccessTokens');

var updateOauthAuthorization = require('../../../testUtils/db/updateOauthAuthorization');

var successRespReg = new RegExp('(?=.*access_token)(?=.*token_type)'
                              + '(?=.*expires_in)(?=.*refresh_token)'
                              + '(?=.*user_id)(?=.*user_status)');

var authorizationHeader = function (clientID, clientSecret) {
    return 'Basic ' 
        + new Buffer(clientID + ':' + clientSecret)
                .toString('base64');
};

module.exports = function (credentialsMedium) {
    var validCredentialsMedium = ['header', 'request'];

    assert.ok(validCredentialsMedium.indexOf(credentialsMedium) !== -1,
              'argument `credentialsMedium` is invalid. '
              + '(Must be set to: ' + validCredentialsMedium.join(', ') + ')');

    describe('POST /oauth/token (Authorization code grant type) '
             + '(Client credentials in ' + credentialsMedium + ')', function () {
        
        var app = null;
        var makeARequest = null;
        
        before(function (done) {
            require('../../../index')(function (err, _app) {
                if (err) {
                    return done(err);
                }

                app = _app;

                makeARequest = function (_request, statusCode, data, body, done) {
                    _request = _request || request(app).post('/oauth/token');

                    _request
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
                        .send(data)
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
                };

                done();
            });
        });

        it('responds with HTTP code 400 and `invalid_grant` '
           + 'error when invalid code', function (done) {

            getOauthClientAccessToken.call({
                redirectionURIResponseType: 'code',
                dontUseCode: true
            }, function (err, resp) {
                var _request = request(app).post('/oauth/token')
                                           .set('Authorization', 
                                                credentialsMedium === 'header' 
                                                    ? authorizationHeader(resp.client.client_id,
                                                                          resp.client.client_secret)
                                                    : '');

                if (err) {
                    return done(err);
                }

                makeARequest(_request, 400, {
                    client_id: credentialsMedium === 'header' 
                                ? '' 
                                : resp.client.client_id,
                    client_secret: resp.client.client_secret,

                    code: 'bar',
                    grant_type: 'authorization_code'
                }, '{"error":"invalid_grant"}', done);
            });
        });

        it('responds with HTTP code 400 and `invalid_grant` '
           + 'error when used code', function (done) {

            async.auto({
                getAuthorizationCode: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIResponseType: 'code',
                        dontUseCode: false
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                getAccessToken: ['getAuthorizationCode', function (cb, results) {
                    var resp = results.getAuthorizationCode;
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? authorizationHeader(resp.client.client_id,
                                                                          resp.client.client_secret)
                                                        : '');
                                           
                    makeARequest(_request, 400, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : resp.client.client_id,
                        client_secret: resp.client.client_secret,

                        code: resp.code,
                        grant_type: 'authorization_code'
                    }, '{"error":"invalid_grant"}', function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp.body);
                    });
                }],

                // According to RFC we muste remove 
                // issued authorization when used code was sent
                assertAuthorizationWasRemoved: ['getAccessToken', function (cb, results) {
                    var resp = results.getAuthorizationCode;

                    findOauthAuthorizations.call({
                        findConditions: {
                            'code.value': createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.AUTHORIZATION_CODES,
                                resp.code
                            )
                        }
                    }, [], function (err, oauthAuthorizations) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAuthorizations.length, 0);

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

        it('responds with HTTP code 400 and `invalid_grant` '
           + 'error when expired code', function (done) {

            async.auto({
                getAuthorizationCode: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIResponseType: 'code',
                        dontUseCode: true
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                expiresCode: ['getAuthorizationCode', function (cb, results) {
                    var resp = results.getAuthorizationCode;

                    updateOauthAuthorization({
                        'code.value': createHash(
                            config.EVENID_OAUTH.HASHING_ALGORITHMS.AUTHORIZATION_CODES,
                            resp.code
                        )
                    }, {
                        'code.expires_at': new Date(0)
                    }, function (err) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null);
                    });
                }],

                getAccessToken: ['expiresCode', function (cb, results) {
                    var resp = results.getAuthorizationCode;
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? authorizationHeader(resp.client.client_id,
                                                                          resp.client.client_secret)
                                                        : '');
                                           
                    makeARequest(_request, 400, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : resp.client.client_id,
                        client_secret: resp.client.client_secret,

                        code: resp.code,
                        grant_type: 'authorization_code'
                    }, '{"error":"invalid_grant"}', function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp.body);
                    });
                }],

                // According to RFC we muste remove 
                // issued authorization when expired code was sent
                assertAuthorizationWasRemoved: ['getAccessToken', function (cb, results) {
                    var resp = results.getAuthorizationCode;

                    findOauthAuthorizations.call({
                        findConditions: {
                            'code.value': createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.AUTHORIZATION_CODES,
                                resp.code
                            )
                        }
                    }, [], function (err, oauthAuthorizations) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAuthorizations.length, 0);

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

        it('responds with HTTP code 200 and '
           + 'access token when valid code', function (done) {

            async.auto({
                getAuthorizationCode: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIResponseType: 'code',
                        dontUseCode: true
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                getAccessToken: ['getAuthorizationCode', function (cb, results) {
                    var getAuthorizationCodeResp = results.getAuthorizationCode;
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? authorizationHeader(getAuthorizationCodeResp.client.client_id,
                                                                          getAuthorizationCodeResp.client.client_secret)
                                                        : '');
                                           
                    makeARequest(_request, 200, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : getAuthorizationCodeResp.client.client_id,
                        client_secret: getAuthorizationCodeResp.client.client_secret,

                        code: getAuthorizationCodeResp.code,
                        grant_type: 'authorization_code'
                    }, successRespReg, function (err, getAccessTokenResp) {
                        var getAccessTokenRespBody = getAccessTokenResp.body;

                        if (err) {
                            return cb(err);
                        }

                        // Make sure user id is client specific
                        assert.notEqual(getAccessTokenRespBody.user_id,
                                        getAuthorizationCodeResp.user.id);

                        cb(null, getAccessTokenRespBody);
                    });
                }],

                assertIsUsedWasSetForCode: ['getAccessToken', function (cb, results) {
                    var resp = results.getAuthorizationCode;

                    findOauthAuthorizations.call({
                        findConditions: {
                            'code.value': createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.AUTHORIZATION_CODES,
                                resp.code
                            )
                        }
                    }, [], function (err, oauthAuthorizations) {
                        var oauthAuthorization = oauthAuthorizations[0];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAuthorizations.length, 1);

                        assert.strictEqual(oauthAuthorization.code.is_used, true);

                        cb(null, oauthAuthorization);
                    });
                }],

                assertAccessTokenWasInserted: ['assertIsUsedWasSetForCode', function (cb, results) {
                    var resp = results.getAccessToken;
                    var oauthAuthorization = results.assertIsUsedWasSetForCode;

                    findOauthAccessTokens.call({
                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.access_token
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refresh_token
                            ),

                            authorization: oauthAuthorization.id
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAccessTokens.length, 1);

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
};