var assert = require('assert');
var request = require('supertest');

var mongoose = require('mongoose');
var async = require('async');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var expireResetPasswordRequest = require('../../../../testUtils/db/expireResetPasswordRequest');
var updateResetPasswordRequest = require('../../../../testUtils/db/updateResetPasswordRequest');

var createRecoverPasswordRequest = require('../../../../testUtils/users/createRecoverPasswordRequest');
var findResetPasswordRequests = require('../../../../testUtils/db/findResetPasswordRequests');

var findEmails = require('../../../../testUtils/db/findEmails');
var updateEmail = require('../../../../testUtils/db/updateEmail');

var makeARequest = null;
var app = null;

var invalidCode = 'afba34a2a11ab13eeba5d0a7aa22bbb6120e177b';

var successReg = /(?=.*\{)(?=.*email)(?=.*[^\s]+@[^\s]+)/;
    
describe('GET /users/recover-password/:code', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, code) {
                    var context = this;

                    var req = null;
                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    if (err) {
                        return done(err);
                    }
                    
                    request(app)
                        .get('/users/recover-password/' + code)
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

                if (this.code) {
                    return cb(null, this.accessToken, this.code);
                }

                createRecoverPasswordRequest(function (err, resetPasswordRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resetPasswordRequest.accessToken,
                       resetPasswordRequest.code);
                });
            };

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            getNonAppAccessToken = getNonAppAccessToken(app);

            getAppAccessToken = getAppAccessToken(app);
            createRecoverPasswordRequest = createRecoverPasswordRequest(app, getAppAccessToken);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            var accessToken = !err && resetPasswordRequest.accessToken;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                code: resetPasswordRequest.code
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                code: resetPasswordRequest.code
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            var accessToken = !err && resetPasswordRequest.accessToken;

            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    code: resetPasswordRequest.code
                }, 400, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            var accessToken = !err && resetPasswordRequest.accessToken;

            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    code: resetPasswordRequest.code
                }, 400, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when non-app token try to recover password', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            if (err) {
                return done(err);
            }
            
            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    code: resetPasswordRequest.code
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when auth-app token try to recover password', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            if (err) {
                return done(err);
            }
            
            getAppAccessToken(function (err, accessToken, user) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    code: resetPasswordRequest.code
                }, 403, /access_denied/, done);
            })
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use invalid code', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: resetPasswordRequest.accessToken,
                code: invalidCode
            }, 403, /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use expired code', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            if (err) {
                return done(err);
            }

            expireResetPasswordRequest(resetPasswordRequest.code, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: resetPasswordRequest.accessToken,
                    code: resetPasswordRequest.code
                }, 403, /access_denied/, function (err, resp) {
                    if (err) {
                        return done(err);
                    }

                    // Make sure reset password request was deleted
                    findResetPasswordRequests([resetPasswordRequest.id], 
                                              function (err, resetPasswordRequests) {

                        if (err) {
                            return done(err);
                        }

                        assert.strictEqual(resetPasswordRequests.length, 0);

                        done();
                    });
                });
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use code not attached to email', function (done) {

        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            if (err) {
                return done(err);
            }

            updateResetPasswordRequest({
                code: resetPasswordRequest.code
            }, {
                email: mongoose.Types.ObjectId().toString()
            }, function (err) {
                
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: resetPasswordRequest.accessToken,
                    code: resetPasswordRequest.code
                }, 403, /access_denied/, function (err, resp) {
                    if (err) {
                        return done(err);
                    }

                    // Make sure reset password request was deleted
                    findResetPasswordRequests([resetPasswordRequest.id], 
                                              function (err, resetPasswordRequests) {

                        if (err) {
                            return done(err);
                        }

                        assert.strictEqual(resetPasswordRequests.length, 0);

                        done();
                    });
                });
            });
        });
    });

    it('responds with HTTP code 200 and email when valid code and unverified email', function (done) {
        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            var email = resetPasswordRequest && resetPasswordRequest.user.emails[0];

            if (err) {
                return done(err);
            }

            assert.strictEqual(email.is_verified, false);

            makeARequest.call({
                accessToken: resetPasswordRequest.accessToken,
                code: resetPasswordRequest.code
            }, 200, successReg, function (err, resp) {
                if (err) {
                    return done(err);
                }

                // Make sure email was validated
                findEmails([email.id], function (err, emails) {
                    var email = emails && emails[0];

                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    assert.strictEqual(email.is_verified, true);

                    done();
                });
            });
        });
    });

    it('responds with HTTP code 200 and email when valid code and verified email', function (done) {
        createRecoverPasswordRequest(function (err, resetPasswordRequest) {
            var email = resetPasswordRequest && resetPasswordRequest.user.emails[0];

            if (err) {
                return done(err);
            }

            updateEmail({
                _id: email.id
            }, {
                is_verified: true
            }, function (err, updatedEmail) {
                if (err) {
                    return cb(err);
                }
                
                // Make sure update was made
                findEmails([email.id], function (err, emails) {
                    var email = emails && emails[0];

                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    assert.strictEqual(email.is_verified, true);

                    // Make sure it works with verified email
                    makeARequest.call({
                        accessToken: resetPasswordRequest.accessToken,
                        code: resetPasswordRequest.code
                    }, 200, successReg, function (err, resp) {
                        if (err) {
                            return done(err);
                        }

                        done();
                    });
                });
            });
        });
    });
});