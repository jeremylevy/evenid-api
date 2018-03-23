var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var findUsers = require('../../../../testUtils/db/findUsers');
var createEmail = require('../../../../testUtils/db/createEmail');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');
var removeEventCollection = require('../../../../testUtils/db/removeEventCollection');

var isInvalidRequestError = require('../../../../testUtils/validators/isInvalidRequestError');
var isValidTimezone = require('../../../../models/validators/isValidTimezone');

var createUserMock = require('../../../../testUtils/mocks/routes/users/post/createUser');

var makeARequest = null;
var app = null;

var invalidUser = function () {
    return {
        email: 'foo',
        password: 'bar'
    };
};
var invalidUserReg = /(?=.*error)(?=.*email)(?=.*password)/;

var validUser = function () {
    return {
        email: mongoose.Types.ObjectId().toString() + '@evenid.com',
        password: 'azerty'
    };
};
var validUserReg = new RegExp('(?=.*id)'
                            + '(?=.*email)(?=.*gravatar)'
                            + '(?=.*is_test_account)'
                            + '(?=.*authorized_clients)'
                            + '(?=.*developer)(?=.*phone_numbers)'
                            + '(?=.*addresses)'
                            + '(?!.*"password")'
                            + '(?!.*"_id")'
                            + '(?!.*"__v")');

var assertUserWasCreated = function (user, cb) {
    if (!user) {
        user = validUser();
    }

    async.auto({
        createUser: function (cb) {
            makeARequest(200, user, validUserReg, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                /* Emails are not populated 
                   and password is hashed 
                   so we cannot assert the return */

                cb(null, resp.body);
            });
        },

        assertUserWasCreated: ['createUser', function (cb, results) {
            var createdUser = results.createUser;

            findUsers([createdUser.id], function (err, users) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(users.length, 1);

                /* Emails are not populated 
                   and password is hashed */
                assert.strictEqual(users[0].emails.length, 1);
                assert.strictEqual(users[0].password.length, 60);

                if (user.timezone) {
                    if (isValidTimezone(user.timezone)) {
                        assert.strictEqual(users[0].timezone, user.timezone);
                    } else {
                        assert.strictEqual(users[0].timezone, undefined);
                    }
                }

                assert.strictEqual(users[0].auto_login, true);

                cb();
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb();
    });
};

var mockScopes = [];
    
describe('POST /users', function () {
    before(function (done) {
        // Make sure mocks are not set
        // before THIS test run
        mockScopes = createUserMock();
        
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
                            .post('/users')
                            // Body parser middleware needs it to populate `req.body`
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

            // Needs to be cleaned to test
            // max attempts error
            removeEventCollection(done);
        });
    });

    // Make sure all requests were made
    after(function () {
        mockScopes.forEach(function (mockScope) {
            assert.ok(mockScope.isDone());
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken
            }, 400, validUser(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
            }, 400, validUser(), /invalid_token/, done);
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
                }, 400, validUser(), /expired_token/, done);
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
                }, 400, validUser(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when non-app token try to create user', function (done) {

        getNonAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken
            }, 403, validUser(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when auth-app token try to create user', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken
            }, 403, validUser(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when no IP header was sent', function (done) {
        
        makeARequest.call({
            noIPHeader: true
        }, 400, validUser(), /invalid_request/, function (err, resp) {
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
        }, 400, validUser(), /invalid_request/, function (err, resp) {
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

        var oldValue = config.EVENID_EVENTS
                             .MAX_ATTEMPTS
                             .USER_CREATED;

        // Make sure it was different from default
        var IPAddress = '192.168.13.1';

        config.EVENID_EVENTS
              .MAX_ATTEMPTS
              .USER_CREATED = 0;

        makeARequest.call({
            IPHeader: IPAddress
        }, 403, validUser(), new RegExp(
            '(?=.*error)(?=.*max_attempts_reached)'
        ), function (err, resp) {
            
            if (err) {
                return done(err);
            }

            config.EVENID_EVENTS
                  .MAX_ATTEMPTS
                  .USER_CREATED = oldValue;

            done();
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when max attempts captcha is invalid', function (done) {

        var oldValue = config.EVENID_EVENTS
                             .MAX_ATTEMPTS
                             .USER_CREATED;

        // Make sure it was different 
        // from default and previous test
        var IPAddress = '192.168.13.2';

        config.EVENID_EVENTS
              .MAX_ATTEMPTS
              .USER_CREATED = 0;

        makeARequest.call({
            IPHeader: IPAddress
        }, 403, {
            'g-recaptcha-response': 'TEST_INVALID_CAPTCHA'
        }, /(?=.*error)(?=.*max_attempts_captcha_error)/, function (err, resp) {

            if (err) {
                return done(err);
            }

            config.EVENID_EVENTS
                  .MAX_ATTEMPTS
                  .USER_CREATED = oldValue;

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when valid captcha and invalid user infos', function (done) {

        var oldValue = config.EVENID_EVENTS
                             .MAX_ATTEMPTS
                             .USER_CREATED;

        // Make sure it was different 
        // from default and previous test
        var IPAddress = '192.168.13.3';

        var user = invalidUser();

        config.EVENID_EVENTS
              .MAX_ATTEMPTS
              .USER_CREATED = 0;

        user['g-recaptcha-response'] = 'TEST_VALID_CAPTCHA';

        makeARequest.call({
            IPHeader: IPAddress
        }, 400, user, invalidUserReg, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            config.EVENID_EVENTS
                  .MAX_ATTEMPTS
                  .USER_CREATED = oldValue;

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + ' error when email is already used', function (done) {

        createEmail(function (err, email) {
            var validUserData = validUser();

            if (err) {
                return done(err);
            }

            validUserData.email = email.address;

            makeARequest(400, validUserData, /(?=.*error)(?=.*email)(?!.*password)/, done);
        });
    });

    // Make sure password error 
    // is returned alongs with email error
    it('responds with HTTP code 400 and `invalid_request` '
       + ' error when email is already used and password is invalid', function (done) {

        createEmail(function (err, email) {
            var validUserData = validUser();

            if (err) {
                return done(err);
            }

            validUserData.email = email.address;
            validUserData.password = '';

            makeARequest(400, validUserData, invalidUserReg, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid user infos', function (done) {

        makeARequest(400, invalidUser(), invalidUserReg, done);
    });

    it('responds with HTTP code 200 and user '
       + 'when valid captcha ', function (done) {
        
        var oldValue = config.EVENID_EVENTS
                             .MAX_ATTEMPTS
                             .USER_CREATED;
        
        var user = validUser();

        config.EVENID_EVENTS
              .MAX_ATTEMPTS
              .USER_CREATED = 0;

        user['g-recaptcha-response'] = 'TEST_VALID_CAPTCHA';

        assertUserWasCreated(user, function (err) {
            if (err) {
                return done(err);
            }

            config.EVENID_EVENTS
                  .MAX_ATTEMPTS
                  .USER_CREATED = oldValue;

            done();
        });
    });

    it('responds with HTTP code 200 and user when '
       + 'valid user infos', function (done) {

        var user = null;

        assertUserWasCreated(user, done);
    });

    it('responds with HTTP code 200 and user when '
       + 'valid user infos and timezone', function (done) {

        var user = validUser();

        user.timezone = 'Europe/Paris';

        assertUserWasCreated(user, done);
    });

    it('responds with HTTP code 200 and user when '
       + 'valid user infos and invalid timezone', function (done) {

        var user = validUser();

        user.timezone = 'bar';

        assertUserWasCreated(user, done);
    });
});