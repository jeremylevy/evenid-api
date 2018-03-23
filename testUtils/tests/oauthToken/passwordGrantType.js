var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../config');

var createHash = require('../../../libs/createHash');

var GetAppAccessToken = require('../../getAppAccessToken');

var findOauthAccessTokens = require('../../db/findOauthAccessTokens');
var findUsers = require('../../db/findUsers');

var updateUser = require('../../db/updateUser');

var isInvalidRequestError = require('../../validators/isInvalidRequestError');

var createEmail = require('../../../testUtils/db/createEmail');

var passwordGrantTypeMock = require('../../../testUtils/mocks/routes/oauth/token/post/passwordGrantType');

var successRespReg = new RegExp('(?=.*access_token)(?=.*token_type)'
                              + '(?=.*expires_in)(?=.*refresh_token)'
                              + '(?=.*user_id)'
                              // User status is meaningless for app client.
                              + '(?!.*user_status)');

module.exports = function (credentialsMedium) {
    var validCredentialsMedium = ['header', 'request'];

    assert.ok(validCredentialsMedium.indexOf(credentialsMedium) !== -1,
              'argument `credentialsMedium` is invalid. '
              + '(Must be set to: ' + validCredentialsMedium.join(', ') + ')');

    describe('POST /oauth/token (Password grant type) '
             + '(Client credentials in ' + credentialsMedium + ')', function () {

        var mockScopes = [];
        var app = null;
        
        var makeARequest = null;
        var getAppAccessToken = null;

        var testCaptcha = function (captchaData, statusCode, expectedReg, cb) {
            var context = this;

            var _request = null;
            var data = {
                client_id: credentialsMedium === 'header' 
                            ? '' 
                            : config.EVENID_APP.CLIENT_ID,

                client_secret: credentialsMedium === 'header' 
                                ? '' 
                                : config.EVENID_APP.CLIENT_SECRET,

                grant_type: 'password',
                password: 'bar'
            };

            var oldMaxAttemptsValue = config.EVENID_EVENTS
                                            .MAX_ATTEMPTS
                                            .INVALID_LOGIN;

            if (captchaData) {
                for (var captchaDataKey in captchaData) {
                    data[captchaDataKey] = captchaData[captchaDataKey];
                }
            }

            config.EVENID_EVENTS
                  .MAX_ATTEMPTS
                  .INVALID_LOGIN = 0;

            _request = request(app).post('/oauth/token')
                                   .set('Authorization', 
                                        credentialsMedium === 'header' 
                                            ? config.EVENID_APP
                                                .AUTHORIZATION_HTTP_HEADER 
                                            : '');

            if (!context.noIPHeader) {
                _request.set('X-Originating-Ip', context.IPHeader || '127.0.0.1');
            }

            // During login, captcha is checked after 
            // we have asserted that email exists
            getAppAccessToken(function (err, accessToken, user) {
                if (err) {
                    return cb(err);
                }

                if (!data.username) {
                    data.username = user.email;
                }       

                makeARequest(_request, statusCode, data, expectedReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    config.EVENID_EVENTS
                          .MAX_ATTEMPTS
                          .INVALID_LOGIN = oldMaxAttemptsValue;

                    cb(null, resp);
                });
            });
        };

        var isSuccessfulResponse = function (getAccessToken, done) {
            async.auto({
                getUser: function (cb) {
                    getAppAccessToken(function (err, accessToken, user) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(user.auto_login, true);

                        cb(null, user);
                    });
                },

                getAccessToken: ['getUser', function (cb, results) {
                    var user = results.getUser;

                    getAccessToken(user, cb);
                }],

                assertAuthAndAccessTokenWereInserted: ['getAccessToken', function (cb, results) {
                    var resp = results.getAccessToken;

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

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAccessTokens.length, 1);

                        assert.ok(!!oauthAccessToken.authorization._id);

                        cb();
                    });
                }],

                assertUserWasUpdated: ['getAccessToken', function (cb, results) {
                    var user = results.getUser;

                    findUsers([user.id], function (err, users) {
                        var user = users && users[0];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(users.length, 1);

                        assert.strictEqual(user.auto_login, false);

                        cb(null);
                    });
                }]
            }, function (err, results) {
                if (err) {
                    return done(err);
                }

                done();
            });
        };
        
        before(function (done) {
            mockScopes = passwordGrantTypeMock();

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

                getAppAccessToken = GetAppAccessToken(app);

                done();
            });
        });

        // Make sure all requests were made
        after(function () {
            mockScopes.forEach(function (mockScope) {
                assert.ok(mockScope.isDone());
            });
        });
        
        /* Invalid client credentials and when 
           non-app client try to use `password`
           grant type errors are tested in `checkClient` */

        it('responds with HTTP code 400 and `invalid_grant` '
           + 'error when invalid user email', function (done) {

            var _request = request(app).post('/oauth/token')
                                       .set('Authorization', 
                                            credentialsMedium === 'header' 
                                                ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER 
                                                : '');

            makeARequest(_request, 400, {
                client_id: credentialsMedium === 'header' 
                            ? ''
                            : config.EVENID_APP.CLIENT_ID,

                client_secret: credentialsMedium === 'header' 
                            ? '' 
                            : config.EVENID_APP.CLIENT_SECRET,

                grant_type: 'password',
                username: 'bar',
                password: mongoose.Types.ObjectId().toString()
            }, new RegExp(
                '(?=.*error)(?=.*invalid_grant)'
                + '(?=.*invalid_email":true)'
                + '(?=.*invalid_password":false)'
            ), done);
        });

        it('responds with HTTP code 400 and `invalid_grant` '
           + 'error when invalid user password', function (done) {

            var _request = request(app).post('/oauth/token')
                                       .set('Authorization', 
                                            credentialsMedium === 'header' 
                                                ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER 
                                                : '');

            getAppAccessToken(function (err, accessToken, user) {
                if (err) {
                    return done(err);
                }

                makeARequest(_request, 400, {
                    client_id: credentialsMedium === 'header' 
                                ? ''
                                : config.EVENID_APP.CLIENT_ID,

                    client_secret: credentialsMedium === 'header' 
                                ? '' 
                                : config.EVENID_APP.CLIENT_SECRET,

                    grant_type: 'password',
                    username: user.email,
                    password: mongoose.Types.ObjectId().toString()
                }, new RegExp(
                    '(?=.*error)(?=.*invalid_grant)'
                    + '(?=.*invalid_email":false)'
                    + '(?=.*invalid_password":true)'
                ), done);
            });
        });

        it('responds with HTTP code 400 and `invalid_request` '
           + 'error when no IP header was sent during captcha check', function (done) {
            
            var dataToSend = {
                'g-recaptcha-response': 'bar'
            };

            testCaptcha.call({
                noIPHeader: true
            }, dataToSend, 400, /invalid_request/, function (err, resp) {
                var error = resp && resp.body.error;

                if (err) {
                    return done(err);
                }

                // `['X-Originating-IP']`: message properties
                isInvalidRequestError(error, ['X-Originating-IP']);

                done();
            });
        });

        it('responds with HTTP code 400 and `invalid_request` '
           + 'error when invalid IP header was sent during captcha check', function (done) {
            
            var dataToSend = {
                'g-recaptcha-response': 'bar'
            };

            testCaptcha.call({
                IPHeader: 'bar'
            }, dataToSend, 400, /invalid_request/, function (err, resp) {
                var error = resp && resp.body.error;

                if (err) {
                    return done(err);
                }

                // `['X-Originating-IP']`: message properties
                isInvalidRequestError(error, ['X-Originating-IP']);

                done();
            });
        });

        it('responds with HTTP code 403 and `access_denied` '
         + 'error when max attempts were reached', function (done) {

            var dataToSend = {};

            testCaptcha(dataToSend, 403, /(?=.*error)(?=.*max_attempts_reached)/, done);
        });

        it('responds with HTTP code 403 and `access_denied` '
         + 'error when invalid max attempts captcha', function (done) {

            testCaptcha({
                'g-recaptcha-response': 'TEST_INVALID_CAPTCHA'
            }, 403, /(?=.*error)(?=.*max_attempts_captcha_error)/, done);
        });

        it('responds with HTTP code 400 and `invalid_grant` '
         + 'error when max attempts captcha is valid '
         + 'but not the identifiers of the user', function (done) {

            testCaptcha({
                // username will be created in `testCaptcha` 
                // function given that it needs to be valid 
                // in order to captcha to be checked.
                password: 'bar',
                'g-recaptcha-response': 'TEST_VALID_CAPTCHA'
            }, 400, new RegExp(
                '(?=.*error)(?=.*invalid_grant)'
              + '(?=.*invalid_email":false)'
              + '(?=.*invalid_password":true)'
              + '(?!.*max_attempts_captcha_error)'
            ), done);
        });

        it('responds with HTTP code 200 and access token '
           + 'when valid user credentials and valid captcha', function (done) {

            isSuccessfulResponse(function (user, cb) {
                testCaptcha({
                    'g-recaptcha-response': 'TEST_VALID_CAPTCHA',
                    username: user.email,
                    password: user.password
                }, 200, successRespReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    // Make sure user ID is not client specific
                    assert.strictEqual(resp.body.user_id, user.id);

                    cb(null, resp.body);
                });
            }, done);
        });

        it('responds with HTTP code 200 and access token '
           + 'when valid user credentials were passed', function (done) {

            isSuccessfulResponse(function (user, cb) {
                var _request = request(app).post('/oauth/token')
                                           .set('Authorization', 
                                                credentialsMedium === 'header' 
                                                    ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER 
                                                    : '');

                makeARequest(_request, 200, {
                    client_id: credentialsMedium === 'header' 
                                ? '' 
                                : config.EVENID_APP.CLIENT_ID,

                    client_secret: credentialsMedium === 'header' 
                                    ? '' 
                                    : config.EVENID_APP.CLIENT_SECRET,

                    grant_type: 'password',
                    username: user.email,
                    password: user.password
                }, successRespReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    // Make sure user ID is not client specific
                    assert.strictEqual(resp.body.user_id, user.id);

                    cb(null, resp.body);
                });
            }, done);
        });

        it('responds with HTTP code 200 and access token '
           + 'when user is auto logged', function (done) {
            
            var oldMaxAttemptsValue = config.EVENID_EVENTS
                                            .MAX_ATTEMPTS
                                            .INVALID_LOGIN;

            config.EVENID_EVENTS
                  .MAX_ATTEMPTS
                  .INVALID_LOGIN = 0;
                  
            isSuccessfulResponse(function (user, cb) {
                updateUser({
                    _id: user.id
                }, {
                    auto_login: true
                }, function (err, updatedUser) {
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER 
                                                        : '');
                    
                    if (err) {
                        return cb(err);
                    }

                    makeARequest(_request, 200, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : config.EVENID_APP.CLIENT_ID,

                        client_secret: credentialsMedium === 'header' 
                                        ? '' 
                                        : config.EVENID_APP.CLIENT_SECRET,

                        grant_type: 'password',
                        username: user.email,
                        password: user.password
                    }, successRespReg, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        config.EVENID_EVENTS
                              .MAX_ATTEMPTS
                              .INVALID_LOGIN = oldMaxAttemptsValue;

                        cb(null, resp.body);
                    });
                });
            }, done);
        });
    });
};