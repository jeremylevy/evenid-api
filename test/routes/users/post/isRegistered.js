var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var createEmail = require('../../../../testUtils/db/createEmail');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');
var removeEventCollection = require('../../../../testUtils/db/removeEventCollection');

var isInvalidRequestError = require('../../../../testUtils/validators/isInvalidRequestError');

var makeARequest = null;
var app = null;

var validRequest = function () {
    return {
        email: mongoose.Types.ObjectId().toString() + '@evenid.com'
    };
};
    
describe('POST /users/is-registered', function () {
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

                    req = request(app)
                            .post('/users/is-registered')
                            // Body parser middleware needs it 
                            // to populate `req.body`
                            .set('Content-Type', 'application/x-www-form-urlencoded')
                            .set('Authorization', authHeader);

                    if (!context.noIPHeader) {
                        req.set('X-Originating-Ip', context.IPHeader || '127.0.0.1');
                    }
                    
                    req.send(data)
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

    after(function (done) {
        removeEventCollection(done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken
            }, 400, validRequest(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
            }, 400, validRequest(), /invalid_token/, done);
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
                    accessToken: accessToken
                }, 400, validRequest(), /expired_token/, done);
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
                    accessToken: accessToken
                }, 400, validRequest(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error '
       + 'when non-app token try to create user', function (done) {

        getNonAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken
            }, 403, validRequest(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error '
       + 'when auth-app token try to check for user existence', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken
            }, 403, validRequest(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when no IP header was sent', function (done) {
        
        makeARequest.call({
            noIPHeader: true
        }, 400, validRequest(), /invalid_request/, function (err, resp) {
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
       + 'error when invalid IP header was sent', function (done) {
        
        makeARequest.call({
            IPHeader: 'bar'
        }, 400, validRequest(), /invalid_request/, function (err, resp) {
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

        var oldValue = config.EVENID_EVENTS.MAX_ATTEMPTS.CHECK_FOR_USER_EXISTENCE;
        // Make sure it was different from default
        var IPAddress = '192.168.13.1';

        config.EVENID_EVENTS.MAX_ATTEMPTS.CHECK_FOR_USER_EXISTENCE = 1;

        makeARequest.call({
            IPHeader: IPAddress
        }, 200, validRequest(), '{"is_registered":false}', function (err, resp) {

            if (err) {
                return done(err);
            }

            makeARequest.call({
                IPHeader: IPAddress
            }, 403, validRequest(), new RegExp(
                '(?=.*error)(?=.*max_attempts_reached)'
            ), function (err, resp) {
                
                if (err) {
                    return done(err);
                }

                config.EVENID_EVENTS.MAX_ATTEMPTS.CHECK_FOR_USER_EXISTENCE = oldValue;

                done();
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid user email', function (done) {

        makeARequest(400, {
            email: 'bar'
        }, /(?=.*error)(?=.*email)/, done);
    });

    it('responds with HTTP code 200 and `is_registered` set to '
       + '`false` when email doesn\'t exist', function (done) {

        makeARequest(200, {
            email: 'foo@evenid.com'
        }, '{"is_registered":false}', done);
    });

     it('responds with HTTP code 200 and `is_registered` '
       + 'set to `true` when email exists', function (done) {

        var user = null;

        createEmail(function (err, email) {
            if (err) {
                return done(err);
            }

            makeARequest(200, {
                email: email.address
            }, '{"is_registered":true}', done);
        });
    });
});