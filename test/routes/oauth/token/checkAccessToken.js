var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

var AssertItPassWithToken = function (useHeader) {
    return function (fn, cb) {
        fn(function (err, accessToken) {
            var data = {
                method: 'GET',
                accessToken: accessToken
            };

            if (err) {
                return cb(err);
            }

            if (useHeader) {
                data.authHeader = 'Bearer ' + accessToken;
            } else {
                data.queryString = 'access_token=' + accessToken;
            }

            makeARequest.call(data, 404, /not_found/, cb);
        });
    };
};

describe('ALL checkAccessToken middleware', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            makeARequest = function (statusCode, body, done) {
                // Make sure `checkAccessToken` middleware is set to all routes
                // by providing a falsy URL
                var path = '/' + mongoose.Types.ObjectId().toString();

                var cb = function (err, accessToken, method, authHeader, queryString) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = authHeader || 'Bearer ' + accessToken;

                    var _request = request(app)
                                    [method.toLowerCase()](path + (queryString ? '?' + queryString : ''))
                                    .set('Authorization', queryString ? '' : authHeader);

                    if (method !== 'GET') {
                        // Body parser middleware needs it to populate `req.body`
                        _request.set('Content-Type', 'application/x-www-form-urlencoded');
                    }

                    if (statusCode !== 404) {
                        _request.expect('Content-Type', 'application/json; charset=utf-8')
                                .expect('Cache-Control', 'no-store')
                                .expect('Pragma', 'no-cache');
                    }

                    _request
                        .expect(body)
                        .expect(statusCode, done);
                };

                cb(null, this.accessToken, this.method, this.authHeader, this.queryString);
            };

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });

    // Use all HTTP verbs in tests
    // to make sure `checkAccessToken` middleware 
    // is set to all routes

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {
        
        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                method: 'GET',
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {
        
        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                method: 'POST',
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {
        
        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    method: 'PUT',
                    accessToken: accessToken
                }, 400, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when access token does not have authorization', function (done) {
        
        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    method: 'DELETE',
                    accessToken: accessToken
                }, 400, /invalid_token/, done);
            });
        });
    });

    /* We have passed a falsy URL to make sure `checkAccessToken` middleware
       to make sure `checkAccessToken` middleware is set for all routes
       So check for HTTP 404 error code */

    it('responds with HTTP code 404 when '
       + 'valid access token authorization header', function (done) {

        var useHeader = true;
        var assertItPassWithToken = AssertItPassWithToken(useHeader);

        async.auto({
            assertItPassWithUnauthToken: function (cb) {
                assertItPassWithToken(getUnauthenticatedAppAccessToken, cb);
            },

            assertItPassWithAppToken: function (cb) {
                assertItPassWithToken(getAppAccessToken, cb);
            },

            assertItPassWithOauthClientToken: function (cb) {
                getOauthClientAccessToken(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    assertItPassWithToken(function (cb) {
                        return cb(null, resp.accessToken);
                    }, cb);
                });
            }
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 404 when '
       + 'valid access token querystring parameter', function (done) {
        
        var useHeader = false;
        var assertItPassWithToken = AssertItPassWithToken(useHeader);

        async.auto({
            assertItPassWithUnauthToken: function (cb) {
                assertItPassWithToken(getUnauthenticatedAppAccessToken, cb);
            },

            assertItPassWithAppToken: function (cb) {
                assertItPassWithToken(getAppAccessToken, cb);
            },

            assertItPassWithOauthClientToken: function (cb) {
                getOauthClientAccessToken(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    assertItPassWithToken(function (cb) {
                        return cb(null, resp.accessToken);
                    }, cb);
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