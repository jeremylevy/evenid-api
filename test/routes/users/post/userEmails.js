var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createEmail = require('../../../../testUtils/users/createEmail');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findUsers = require('../../../../testUtils/db/findUsers');

var findEmails = require('../../../../testUtils/db/findEmails');
var findMainEmailAddresses = require('../../../../testUtils/db/findMainEmailAddresses');

var makeARequest = null;
var app = null;

var validEmail = function () {
    return mongoose.Types.ObjectId().toString() + '@evenid.com';
};

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                            + '(?=.*email)(?!.*"_id")'
                            + '(?!.*"__v")');
    
describe('POST /users/:user_id/emails', function () {
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
                              + '/emails')
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
            createEmail = createEmail(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: user.id
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: user.id
            }, 400, {}, /invalid_token/, done);
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
                }, 400, {}, /expired_token/, done);
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
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to create user email', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to create email for user which does not belong to him', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: '507c7f79bcf86cd7994f6c0e'
            }, 403, {
                email: validEmail()
            }, /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 when user has '
       + 'reached the maximum number of emails allowed', function (done) {

        var oldLimit = config.EVENID_USERS.MAX_ENTITIES.EMAILS;
        var errorReg = new RegExp('access_denied'
                                  + '.*'
                                  + 'You have reached the maximum number of '
                                  + 'emails allowed per user\\.');

        // Node.JS cache required modules, so config object is always the SAME
        config.EVENID_USERS.MAX_ENTITIES.EMAILS = 0;

        makeARequest(403, {email: validEmail()}, errorReg, function (err, resp) {
            config.EVENID_USERS.MAX_ENTITIES.EMAILS = oldLimit;

            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid email', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: user.id
            }, 400, {
                email: 'bar',
                password: user.password
            }, /(?=.*invalid_request)(?=.*email)(?!.*password)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid email length', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: user.id
            }, 400, {
                email: 'foo@'
                        + new Array(config.EVENID_EMAILS
                                          .MAX_LENGTHS
                                          .ADDRESS).join('a')
                        + '.com',
                password: user.password
            }, /(?=.*invalid_request)(?=.*email)(?!.*password)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid password', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: user.id
            }, 400, {
                email: validEmail(),
                password: ''
            }, /(?=.*invalid_request)(?=.*password)(?!.*email)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid email and password', function (done) {

        makeARequest(400, {
            email: 'bar',
            password: mongoose.Types.ObjectId().toString()
            // Positive lookahead assertion
        }, /(?=.*invalid_request)(?=.*email)(?=.*password)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when email is already used', function (done) {

        createEmail(function (err, accessToken, userID, emailID, email, user) {
            if (err) {
                return done(err);
            }

            makeARequest(400, {
                email: email,
                password: user.password
                // Positive lookahead assertion
            }, /(?=.*invalid_request)(?=.*email)(?=.*already used)/, done);
        });
    });

    it('responds with HTTP code 200 and email when '
       + 'valid email infos', function (done) {

        async.auto({
            // User starts with email set as main address
            getAppAccessToken: function (cb) {
                getAppAccessToken(function (err, accessToken, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        user: user
                    })
                });
            },

            // We create another main email address
            // to assert we may have only one main email
            // address per user
            createMainEmailAddress: ['getAppAccessToken', function (cb, results) {
                var getAppAccessTokenResp = results.getAppAccessToken;

                makeARequest.call({
                    accessToken: getAppAccessTokenResp.accessToken,
                    userID: getAppAccessTokenResp.user.id
                }, 200, {
                    email: validEmail(),
                    password: getAppAccessTokenResp.user.password,
                    is_main_address: 'true'
                }, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp.body);
                });
            }],

            // Create a "non-main-address" to assert 
            // that main address will not be changed
            createEmail: ['createMainEmailAddress', function (cb, results) {
                var getAppAccessTokenResp = results.getAppAccessToken;
                var insertedEmail = validEmail();
                
                makeARequest.call({
                    accessToken: getAppAccessTokenResp.accessToken,
                    userID: getAppAccessTokenResp.user.id
                }, 200, {
                    email: insertedEmail,
                    password: getAppAccessTokenResp.user.password,
                    is_main_address: 'false'
                }, successReg, function (err, resp) {
                    var email = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns created email
                    assert.strictEqual(email.email, insertedEmail);
                    assert.strictEqual(email.is_main_address, false);

                    cb(null, email);
                });
            }],

            assertEmailsWereCreated: ['createMainEmailAddress', 
                                      'createEmail',
                                      function (cb, results) {
                
                var mainEmailAddress = results.createMainEmailAddress;
                var emailAddress = results.createEmail;

                findEmails([mainEmailAddress.id, emailAddress.id], function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 2);

                    emails.forEach(function (email) {
                        var insertedEmail = email.id === mainEmailAddress.id 
                            ? mainEmailAddress 
                            : emailAddress;
                        
                        assert.strictEqual(email.is_main_address, email.id === mainEmailAddress.id);
                        assert.strictEqual(email.address, insertedEmail.email);
                    });

                    cb();
                });
            }],

            // Make sure email created with `is_main_address` 
            // flag is set as main address
            assertMainEmailAddressWasSetForUser: ['createMainEmailAddress', 
                                                  'createEmail',
                                                  function (cb, results) {
                
                var getAppAccessTokenResp = results.getAppAccessToken;
                var createMainEmailAddressResp = results.createMainEmailAddress;

                findMainEmailAddresses(getAppAccessTokenResp.user.id, function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);
                    assert.strictEqual(emails[0].id, createMainEmailAddressResp.id);

                    cb(null, emails);
                });
            }],

            // Make sure user emails property
            // was updated
            assertUserWasUpdated: ['createEmail', 
                                   'createMainEmailAddress',
                                   function (cb, results) {
                
                var getAppAccessTokenResp = results.getAppAccessToken;
                var mainEmailAddress = results.createMainEmailAddress;
                var emailAddress = results.createEmail;

                findUsers([getAppAccessTokenResp.user.id], function (err, users) {
                    var user = users[0].toObject();

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    // User starts with one email 
                    // plus the two created
                    assert.strictEqual(user.emails.length, 3);

                    for (var i = 0, j = user.emails.length; i < j; ++i) {
                        user.emails[i] = user.emails[i].toString();
                    }

                    [mainEmailAddress.id, emailAddress.id].forEach(function (emailID) {
                        assert.ok(user.emails
                                      .indexOf(emailID) !== -1);
                    });

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