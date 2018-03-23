var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var expireResetPasswordRequest = require('../../../../testUtils/db/expireResetPasswordRequest');
var updateResetPasswordRequest = require('../../../../testUtils/db/updateResetPasswordRequest');

var createRecoverPasswordRequest = require('../../../../testUtils/users/createRecoverPasswordRequest');
var createOauthClient = require('../../../../testUtils/db/createOauthClient');

var findResetPasswordRequests = require('../../../../testUtils/db/findResetPasswordRequests');
var findUsers = require('../../../../testUtils/db/findUsers');

var updateUser = require('../../../../testUtils/db/updateUser');

var makeARequest = null;
var app = null;

var invalidCode = 'afba34a2a11ab13eeba5d0a7aa22bbb6120e177b';

var validNewPassword = function () {
    return {
        password: 'foobar'
    };
}

var successReg = /(?=.*"status":"ok")/;
    
describe('POST /users/recover-password/:code', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, code) {
                    var context = this;

                    var req = null;
                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    if (err) {
                        return done(err);
                    }

                    request(app)
                        .post('/users/recover-password/' + code)
                        .set('Authorization', authHeader)
                        // Body parser middleware needs 
                        // it to populate `req.body`
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
            }, 400, validNewPassword(), /invalid_request/, done);
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
            }, 400, validNewPassword(), /invalid_token/, done);
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
                }, 400, validNewPassword(), /expired_token/, done);
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
                }, 400, validNewPassword(), /invalid_token/, done);
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
                }, 403, validNewPassword(), /access_denied/, done);
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
                }, 403, validNewPassword(), /access_denied/, done);
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
            }, 403, validNewPassword(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use code not attached to email', function (done) {

        async.auto({
            createRecoverPasswordRequest: function (cb) {
                createRecoverPasswordRequest(function (err, resetPasswordRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resetPasswordRequest);
                });
            },

            updateResetPasswordRequest: ['createRecoverPasswordRequest', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                updateResetPasswordRequest({
                    code: resetPasswordRequest.code
                }, {
                    email: mongoose.Types.ObjectId().toString()
                }, function (err) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            tryToResetPassword: ['updateResetPasswordRequest', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                makeARequest.call({
                    accessToken: resetPasswordRequest.accessToken,
                    code: resetPasswordRequest.code
                }, 403, validNewPassword(), /access_denied/, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRequestWasDeleted: ['tryToResetPassword', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                findResetPasswordRequests([resetPasswordRequest.id], 
                                          function (err, resetPasswordRequests) {

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(resetPasswordRequests.length, 0);

                    done();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use expired code', function (done) {

        async.auto({
            createRecoverPasswordRequest: function (cb) {
                createRecoverPasswordRequest(function (err, resetPasswordRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resetPasswordRequest);
                });
            },

            expireResetPasswordRequest: ['createRecoverPasswordRequest', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                expireResetPasswordRequest(resetPasswordRequest.code, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            tryToResetPassword: ['expireResetPasswordRequest', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                makeARequest.call({
                    accessToken: resetPasswordRequest.accessToken,
                    code: resetPasswordRequest.code
                }, 403, validNewPassword(), /access_denied/, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRequestWasDeleted: ['tryToResetPassword', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                findResetPasswordRequests([resetPasswordRequest.id], 
                                          function (err, resetPasswordRequests) {

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(resetPasswordRequests.length, 0);

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

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid new password', function (done) {
        
        makeARequest(400, {
            password: ''
        }, /(?=.*invalid_request)(?=.*password)/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error '
       + 'if client was set as a non ObjectID', function (done) {
        
        var dataToSend = validNewPassword();

        dataToSend.client = 'bar';

        makeARequest(403, dataToSend, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error '
       + 'if client was set as an invalid ObjectID', function (done) {
        
        var dataToSend = validNewPassword();

        dataToSend.client = mongoose.Types.ObjectId().toString();

        makeARequest(403, dataToSend, /access_denied/, done);
    });

    it('responds with HTTP code 200 and status ok when valid code', function (done) {
        var newPassword = mongoose.Types.ObjectId().toString();

        async.auto({
            createRecoverPasswordRequest: function (cb) {
                createRecoverPasswordRequest(function (err, resetPasswordRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resetPasswordRequest);
                });
            },

            tryToResetPassword: ['createRecoverPasswordRequest', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                makeARequest.call({
                    accessToken: resetPasswordRequest.accessToken,
                    code: resetPasswordRequest.code,
                }, 200, {
                    password: newPassword
                }, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRequestWasDeleted: ['tryToResetPassword', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                findResetPasswordRequests([resetPasswordRequest.id], 
                                          function (err, resetPasswordRequests) {

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(resetPasswordRequests.length, 0);

                    cb();
                });
            }],

            assertUserPasswordWasUpdated: ['tryToResetPassword', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;

                findUsers([resetPasswordRequest.user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(users.length, 1);

                    // Make sure password was updated
                    user.comparePassword(newPassword, function (err, ok) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(ok, true);

                        cb();
                    });

                    // User will be logged automatically.
                    // Make sure captcha will not be displayed.
                    assert.strictEqual(user.auto_login, true);
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('responds with HTTP code 200 and next '
       + 'flow when unauthorized client was passed', function (done) {
        
        var dataToSend = validNewPassword();

        createOauthClient(function (err, oauthClient) {
            if (err) {
                return done(err);
            }

            dataToSend.client = oauthClient.client_id.toString();

            makeARequest(200, dataToSend, /"next_flow":"registration"/, done);
        });
    });

    it('responds with HTTP code 200 and next '
       + 'flow when authorized client was passed', function (done) {
        
        var newPassword = mongoose.Types.ObjectId().toString();

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient(function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            },

            createRecoverPasswordRequest: function (cb) {
                createRecoverPasswordRequest(function (err, resetPasswordRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resetPasswordRequest);
                });
            },

            updateUser: ['createOauthClient', 'createRecoverPasswordRequest', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;
                var oauthClient = results.createOauthClient;

                var user = resetPasswordRequest.user;

                updateUser({
                    _id: user.id
                }, {
                    authorized_clients: [oauthClient.id]
                }, cb);
            }],

            tryToResetPassword: ['updateUser', function (cb, results) {
                var resetPasswordRequest = results.createRecoverPasswordRequest;
                var oauthClient = results.createOauthClient;

                makeARequest.call({
                    accessToken: resetPasswordRequest.accessToken,
                    code: resetPasswordRequest.code,
                }, 200, {
                    client: oauthClient.client_id.toString(),
                    password: newPassword
                }, /"next_flow":"login"/, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

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