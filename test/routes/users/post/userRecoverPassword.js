var assert = require('assert');
var request = require('supertest');

var mongoose = require('mongoose');
var querystring = require('querystring');

var config = require('../../../../config');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var expireResetPasswordRequest = require('../../../../testUtils/db/expireResetPasswordRequest');
var updateResetPasswordRequest = require('../../../../testUtils/db/updateResetPasswordRequest');

var createRecoverPasswordRequest = require('../../../../testUtils/users/createRecoverPasswordRequest');
var findResetPasswordRequests = require('../../../../testUtils/db/findResetPasswordRequests');

var userRecoverPasswordEmailMock = require('../../../../testUtils/mocks/routes/users/post/userRecoverPassword');

var makeARequest = null;
var app = null;

var recoverPasswordCode = 'TEST_VALID_CODE';
var successReg = new RegExp('(?=.*id)(?=.*user)'
                            + '(?=.*email)(?=.*code)'
                            + '(?=.*expires_at)(?=.*created_at)');

var getValidOauthAuthQS = function (clientID, redirectionURI) {
    return {
        client_id: clientID.toString(),
        redirect_uri: redirectionURI,
        state: 'bar',
        flow: 'recover_password'
    };
};

var testForInvalidOauthAuthQS = function (qs, cb) {
    getOauthClientAccessToken(function (err, resp) {
        var queryToCheckFor = getValidOauthAuthQS(resp.client.client_id, 
                                                  resp.redirectionURI.uri); 

        Object.keys(qs).forEach(function (key) {
            queryToCheckFor[key] = qs[key];
        });

        makeARequest(400, {
            email: resp.user.email,
            client: resp.client.id,
            query: queryToCheckFor
        }, /invalid_request/, function (err, resp) {
            if (err) {
                return cb(err);
            }

            cb(null, resp);
        });
    });
};

var assertResetPasswordRequestIsCreated = function (resetPasswordRequest, cb) {
    findResetPasswordRequests([resetPasswordRequest],
                              function (err, resetPasswordRequests) {
        
        if (err) {
            return cb(err);
        }

        assert.strictEqual(resetPasswordRequests.length, 1);

        cb();
    });
};
    
describe('POST /users/recover-password', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken) {
                    var context = this;

                    var req = null;
                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    if (err) {
                        return done(err);
                    }

                    request(app)
                        .post('/users/recover-password')
                        .set('Authorization', authHeader)
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
                }.bind(this);

                if (this.accessToken) {
                    return cb(null, this.accessToken);
                }

                getUnauthenticatedAppAccessToken(cb);
            };

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        getUnauthenticatedAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, appAccessToken, user) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    authHeader: 'Bearer  ' + accessToken
                }, 400, {
                    email: user.email
                }, /invalid_request/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
            }, 400, {
                email: user.email
            }, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        getUnauthenticatedAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, appAccessToken, user) {
                if (err) {
                    return done(err);
                }

                expireOauthAccessToken(accessToken, function (err) {
                    if (err) {
                        return done(err);
                    }

                    makeARequest.call({
                        accessToken: accessToken
                    }, 400, {
                        email: user.email
                    }, /expired_token/, done);
                });
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        getUnauthenticatedAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, appAccessToken, user) {
                if (err) {
                    return done(err);
                }

                unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                    if (err) {
                        return done(err);
                    }

                    makeARequest.call({
                        accessToken: accessToken
                    }, 400, {
                        email: user.email
                    }, /invalid_token/, done);
                });
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when non-app token try to recover password', function (done) {

        getAppAccessToken(function (err, appAccessToken, user) {
            if (err) {
                return done(err);
            }
            
            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 403, {
                    email: user.email
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when auth-app token try to recover password', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken
            }, 403, {
                email: user.email
            }, /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + ' error when invalid email', function (done) {

        makeARequest(403, {
            email: 'bar'
        }, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` '
       + ' error when email is not attached to an user', function (done) {

        var email = mongoose.Types.ObjectId().toString() + '@evenid.com';

        makeARequest(403, {
            email: email
        }, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'too many recover password requests were made', function (done) {

        var oldValue = config.EVENID_USER_RESET_PASSWORD_REQUESTS.MAX_ATTEMPTS;

        config.EVENID_USER_RESET_PASSWORD_REQUESTS.MAX_ATTEMPTS = 0;

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return cb(err);
            }

            makeARequest(403, {
                email: user.email
            }, 
            /(?=.*access_denied)(?=.*You have reached the maximum number)/,
            function (err, resp) {
                if (err) {
                    return done(err);
                }

                config.EVENID_USER_RESET_PASSWORD_REQUESTS.MAX_ATTEMPTS = oldValue;

                done();
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error during oauth authorize flow when invalid flow', function (done) {

        testForInvalidOauthAuthQS({
            flow: 'bar'
        }, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error during oauth authorize flow when invalid client', function (done) {

        testForInvalidOauthAuthQS({
            client_id: mongoose.Types.ObjectId().toString()
        }, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error during oauth authorize flow when invalid redirection URI', function (done) {

        testForInvalidOauthAuthQS({
            redirect_uri: 'http://' + mongoose.Types.ObjectId().toString() + '.com'
        }, done);
    });

    it('responds with HTTP code 200 '
       + 'during oauth authorize flow', function (done) {
        
        getOauthClientAccessToken(function (err, resp) {
            var emailLink = null;
            var query = null;
            var mockScopes = [];

            if (err) {
                return done(err);
            }

            query = getValidOauthAuthQS(
                resp.client.client_id,
                resp.redirectionURI.uri
            );

            query.code = recoverPasswordCode;

            emailLink = config.EVENID_APP.ENDPOINT 
                            + '/oauth/authorize?' 
                            + querystring.stringify(query);

            mockScopes = userRecoverPasswordEmailMock(
                [resp.client.name,
                    emailLink,
                    emailLink, 
                    resp.client.name],
                resp.client.name,
                resp.client.logo, 
                emailLink,
                resp.user.email
            );

            makeARequest(200, {
                email: resp.user.email,
                client: resp.client.id,
                query: query
            }, successReg, function (err, resp) {
                if (err) {
                    return done(err);
                }

                mockScopes.forEach(function (mockScope) {
                    assert.ok(mockScope.isDone());
                });

                assertResetPasswordRequestIsCreated(resp.body.id, done);
            });
        });
    });

    it('responds with HTTP code 200 '
       + 'when used on app', function (done) {
        
        getAppAccessToken(function (err, accessToken, user) {
            var mockScopes = [];
            var emailLink = config.EVENID_APP.ENDPOINT 
                                + '/recover-password/' 
                                + recoverPasswordCode;

            if (err) {
                return cb(err);
            }

            mockScopes = userRecoverPasswordEmailMock(
                [config.EVENID_APP.NAME,
                    emailLink,
                    emailLink,
                    config.EVENID_APP.NAME],
                config.EVENID_APP.NAME,
                config.EVENID_APP.LOGO, 
                emailLink,
                user.email
            );

            makeARequest(200, {
                email: user.email
            }, successReg, function (err, resp) {
                if (err) {
                    return done(err);
                }

                mockScopes.forEach(function (mockScope) {
                    assert.ok(mockScope.isDone());
                });

                assertResetPasswordRequestIsCreated(resp.body.id, done);
            });
        });
    });
});