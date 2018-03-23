var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var querystring = require('querystring');

var config = require('../../../config');

var createHash = require('../../../libs/createHash');

// Hooked depending on client type
var _getOauthClientAccessToken = require('../../getOauthClientAccessToken');
var GetAppAccessToken = require('../../getAppAccessToken');

var authorizeAnotherUserForClient = require('../../authorizeAnotherUserForClient');

var findOauthAccessTokens = require('../../db/findOauthAccessTokens');
var findOauthUserEvents = require('../../db/findOauthUserEvents');

var updateOauthAuthorization = require('../../db/updateOauthAuthorization');
var removeOauthAuthorizations = require('../../db/removeOauthAuthorizations');

var compareArray = require('../../lib/compareArray');

var authorizationHeader = function (clientID, clientSecret) {
    return 'Basic ' 
        + new Buffer(clientID + ':' + clientSecret)
                .toString('base64');
};

module.exports = function (credentialsMedium, clientType) {
    var validCredentialsMedium = ['header', 'request'];
    var validClientTypes = ['client', 'app'];

    assert.ok(validCredentialsMedium.indexOf(credentialsMedium) !== -1,
              'argument `credentialsMedium` is invalid. '
              + '(Must be set to: ' + validCredentialsMedium.join(', ') + ')');

    assert.ok(validClientTypes.indexOf(clientType) !== -1,
              'argument `clientType` is invalid. '
              + '(Must be set to: ' + validClientTypes.join(', ') + ')');

    describe('POST /oauth/token (Refresh token grant type for ' + clientType + ') '
             + '(Client credentials in ' + credentialsMedium + ')', function () {

        var app = null;
        var makeARequest = null;

        var getAppAccessToken = null;

        // Depending on client type 
        // called function will be different
        var getOauthClientAccessToken = function () {
            var context = this;
            var args = Array.prototype.slice.call(arguments);
            var done = args[args.length - 1];

            if (clientType === 'client') {
                return _getOauthClientAccessToken.apply(context, args);
            }

            getAppAccessToken(function (err, accessToken, user, refreshToken) {
                if (err) {
                    return done(err);
                }

                done(null, {
                    client: {
                        client_id: config.EVENID_APP.CLIENT_ID,
                        client_secret: config.EVENID_APP.CLIENT_SECRET
                    },
                    accessToken: accessToken,
                    refreshToken: refreshToken,
                    user: user
                });
            });
        };

        var successRespPattern = '(?=.*access_token)(?=.*token_type)'
                               + '(?=.*expires_in)(?=.*refresh_token)'
                               + '(?=.*user_id)';

        var successRespReg = null;

        if (clientType === 'client') {
            successRespPattern += '(?=.*user_status)';
        }

        successRespReg = new RegExp(successRespPattern);
        
        before(function (done) {
            require('../../../index')(function (err, _app) {
                if (err) {
                    return done(err);
                }

                app = _app;
                getAppAccessToken = GetAppAccessToken(app);

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
           + 'error when invalid refresh token', function (done) {

            getOauthClientAccessToken.call({
                redirectionURIResponseType: 'code'
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

                    refresh_token: 'bar',
                    grant_type: 'refresh_token'
                }, '{"error":"invalid_grant"}', done);
            });
        });

        it('responds with HTTP code 400 and `invalid_grant` '
           + 'error when refresh token has not authorization', function (done) {

            async.auto({
                getRefreshToken: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIResponseType: 'code'
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                findOauthAuthorization: ['getRefreshToken', function (cb, results) {
                    var resp = results.getRefreshToken;

                    findOauthAccessTokens.call({
                        populateAuthorization: true,

                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.accessToken
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refreshToken
                            )
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];

                        if (err) {
                            return cb(err);
                        }

                        cb(null, oauthAccessToken.authorization);
                    });
                }],

                removeAuthorization: ['findOauthAuthorization', function (cb, results) {
                    var oauthAuthorization = results.findOauthAuthorization

                    removeOauthAuthorizations({
                        _id: oauthAuthorization._id
                    }, function (err) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null);
                    });
                }],

                getAccessToken: ['removeAuthorization', function (cb, results) {
                    var resp = results.getRefreshToken;
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

                        refresh_token: resp.refreshToken,
                        grant_type: 'refresh_token'
                    }, '{"error":"invalid_grant"}', function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp.body);
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
           + 'error when refresh token was not issued to this client', function (done) {

            async.auto({
                getRefreshToken: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIResponseType: 'code'
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                findOauthAuthorization: ['getRefreshToken', function (cb, results) {
                    var resp = results.getRefreshToken;

                    findOauthAccessTokens.call({
                        populateAuthorization: true,

                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.accessToken
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refreshToken
                            )
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];

                        if (err) {
                            return cb(err);
                        }

                        cb(null, oauthAccessToken.authorization);
                    });
                }],

                updateClientInAuth: ['findOauthAuthorization', function (cb, results) {
                    var oauthAuthorization = results.findOauthAuthorization;

                    updateOauthAuthorization({
                        _id: oauthAuthorization._id
                    }, {
                        'issued_to.client': mongoose.Types.ObjectId()
                    }, function (err) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null);
                    });
                }],

                getAccessToken: ['updateClientInAuth', function (cb, results) {
                    var resp = results.getRefreshToken;
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

                        refresh_token: resp.refreshToken,
                        grant_type: 'refresh_token'
                    }, '{"error":"invalid_grant"}', function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp.body);
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
           + 'access token when valid refresh token', function (done) {

            async.auto({
                getRefreshToken: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIResponseType: 'code'
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                // assert `logged_by_client`,
                // and `logged_with_email` properties 
                // were conserved in new access token
                findInsertedAccessToken: ['getRefreshToken', function (cb, results) {
                    var resp = results.getRefreshToken;

                    findOauthAccessTokens.call({
                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.accessToken
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refreshToken
                            )
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];

                        if (err) {
                            return cb(err);
                        }

                        cb(null, oauthAccessToken);
                    });
                }],

                // Same than above
                updateInsertedAccessToken: ['findInsertedAccessToken', function (cb, results) {
                    var accessToken = results.findInsertedAccessToken;

                    accessToken.logged_with_email = mongoose.Types.ObjectId();
                    accessToken.logged_by_client = mongoose.Types.ObjectId();

                    accessToken.save(function (err, accessToken) {
                        if (err) {
                            return cb(err);
                        }
                        
                        cb(null, accessToken);
                    });
                }],

                getAccessToken: ['updateInsertedAccessToken', function (cb, results) {
                    var getRefreshTokenResp = results.getRefreshToken;
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? authorizationHeader(getRefreshTokenResp.client.client_id,
                                                                              getRefreshTokenResp.client.client_secret)
                                                        : '');

                    makeARequest(_request, 200, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : getRefreshTokenResp.client.client_id,
                        client_secret: getRefreshTokenResp.client.client_secret,

                        refresh_token: getRefreshTokenResp.refreshToken,
                        grant_type: 'refresh_token'
                    }, successRespReg, function (err, getAccessTokenResp) {
                        var getAccessTokenRespBody = getAccessTokenResp.body;

                        if (err) {
                            return cb(err);
                        }

                        if (clientType === 'app') {
                            // Make sure user ID is not client specific
                            assert.strictEqual(getAccessTokenRespBody.user_id,
                                               getRefreshTokenResp.user.id);
                        } else {
                            // Make sure user ID is client specific
                            assert.notEqual(getAccessTokenRespBody.user_id,
                                            getRefreshTokenResp.user.id);
                        }

                        cb(null, getAccessTokenRespBody);
                    });
                }],

                assertOldAccessTokenWasRemoved: ['getAccessToken', function (cb, results) {
                    var resp = results.getRefreshToken;

                    findOauthAccessTokens.call({
                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.accessToken
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refreshToken
                            )
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAccessTokens.length, 0);

                        cb();
                    });
                }],

                assertAuthAndAccessTokenWereInserted: ['getAccessToken', function (cb, results) {
                    var resp = results.getAccessToken;
                    var insertedAccessToken = results.updateInsertedAccessToken;

                    findOauthAccessTokens.call({
                        populateAuthorization: true,

                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.access_token
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refresh_token
                            )
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];
                        var addressesFor = [];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAccessTokens.length, 1);
                        
                        /* assert `logged_by_client`,
                           and `logged_with_email` properties 
                           were conserved in new access token */

                        assert.strictEqual(oauthAccessToken.logged_by_client.toString(),
                                           insertedAccessToken.logged_by_client.toString());

                        assert.strictEqual(oauthAccessToken.logged_with_email.toString(),
                                           insertedAccessToken.logged_with_email.toString());

                        assert.ok(!!oauthAccessToken.authorization._id);

                        cb();
                    });
                }],

                assertEventWasNotInsertedForClientOwner: ['getAccessToken', function (cb, results) {
                    var getRefreshTokenResp = results.getRefreshToken;
                    var clientID = getRefreshTokenResp.client.id;

                    var userID = getRefreshTokenResp.user.id;
                    var query = {
                        user: userID,
                        type: 'login'
                    };

                    if (clientType !== 'app') {
                        query.client = clientID;
                    }

                    findOauthUserEvents(query, function (err, events) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(events.length, 0);

                        cb(null);
                    });
                }]
            }, function (err, results) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
        
        it('inserts event for non client owner', function (done) {
            if (clientType === 'app') {
                return done();
            }

            async.auto({
                // Authorize the second user 
                // that will trigger the login event
                authorizeAnotherUserForClient: function (cb) {
                    authorizeAnotherUserForClient(function (err, results) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, results);
                    })
                },

                // We use the refresh token
                // sent for the second user
                useRefreshToken: ['authorizeAnotherUserForClient', function (cb, results) {
                    var getOauthClientAccessTokenResp = results.authorizeAnotherUserForClient
                                                               .getOauthClientAccessToken;
                    
                    var authorizeAnotherUserResp = results.authorizeAnotherUserForClient
                                                          .authorizeAnotherUser;

                    var client = getOauthClientAccessTokenResp.client;
                    var refreshToken = authorizeAnotherUserResp.accessToken.refresh_token;
                    
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? authorizationHeader(client.client_id,
                                                                              client.client_secret)
                                                        : '');

                    makeARequest(_request, 200, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : client.client_id,
                        client_secret: client.client_secret,

                        refresh_token: refreshToken,
                        grant_type: 'refresh_token'
                    }, successRespReg, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp.body);
                    });
                }],

                // We assert that the login event
                // has been inserted for the second user
                assertOauthUserEventWasInserted: ['useRefreshToken', function (cb, results) {
                    var getOauthClientAccessTokenResp = results.authorizeAnotherUserForClient
                                                               .getOauthClientAccessToken;
                    
                    var authorizeAnotherUserResp = results.authorizeAnotherUserForClient
                                                          .authorizeAnotherUser;

                    var client = getOauthClientAccessTokenResp.client;
                    var userID = authorizeAnotherUserResp.accessToken.user_id;

                    var query = {
                        client: client.id,
                        user: userID,
                        type: 'login'
                    };

                    findOauthUserEvents(query, function (err, events) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(events.length, 1);

                        cb(null);
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