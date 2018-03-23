var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findUsers = require('../../../../testUtils/db/findUsers');

var makeARequest = null;
var app = null;

var validData = function (userPassword) {
    return {
        current_password: userPassword,
        new_password: mongoose.Types.ObjectId().toString()
    };
}

describe('POST /users/:user_id/change-password', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, user) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .post('/users/' + (user.id || user) 
                              + '/change-password')
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
                        .set('Authorization', authHeader)
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

                if (this.userID) {
                    return cb(null, this.accessToken, this.userID);
                }

                getAppAccessToken(cb);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: user.id
            }, 400, validData(user.password), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: user.id
            }, 400, validData(user.password), /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 400, validData(user.password), /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 400, validData(user.password), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to change user password', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 403, validData(user.password), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to change password for user which does not belong to him', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: accessToken,
                userID: '507c7f79bcf86cd7994f6c0e'
            }, 403, validData(user.password), /access_denied/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'invalid current password', function (done) {

        var currentUserPassword = mongoose.Types.ObjectId.toString();

        makeARequest(400, 
                     validData(currentUserPassword),
                     /(?=.*invalid_request)(?=.*current_password)/,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'invalid new password', function (done) {

        var newUserPassword = '';

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }
            
            var data = validData(user.password);

            data.new_password = '';

            makeARequest.call({
                accessToken: accessToken,
                userID: user.id
            }, 400, data, 
            /(?=.*invalid_request)(?=.*new_password)/, done);
        });
    });

    it('responds with HTTP code 200 when '
       + 'valid current and new password', function (done) {

        async.auto({
            createUser: function (cb) {
                getAppAccessToken(function (err, accessToken, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        user: user
                    });
                });
            },

            changeUserPassword: ['createUser', function (cb, results) {
                var createUserResp = results.createUser;
                var accessToken = createUserResp.accessToken;
                var user = createUserResp.user;
                var data = validData(user.password);

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 200, data, '{}', function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, data.new_password);
                });
            }],

            assertUserPasswordWasUpdated: ['changeUserPassword', function (cb, results) {
                var createUserResp = results.createUser;
                var user = createUserResp.user;
                var newUserPassword = results.changeUserPassword;

                findUsers([user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    user.comparePassword(newUserPassword, function (err, ok) {
                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(ok, true);

                        cb();
                    });
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