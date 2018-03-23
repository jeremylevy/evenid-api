var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var getUnauthenticatedAppAccessToken = require('../../../../testUtils/getUnauthenticatedAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var createEmail = require('../../../../testUtils/users/createEmail');
var findValidateEmailRequests = require('../../../../testUtils/db/findValidateEmailRequests');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var userEmailValidateMock = require('../../../../testUtils/mocks/routes/users/post/userEmailValidate');

var makeARequest = null;
var app = null;

var validateEmailCode = 'TEST_VALID_CODE';
var successReg = /(?=.*id)(?=.*user)(?=.*email)/;

var assertValidateEmailRequestIsCreated = function (emailID, userID, cb) {
    var validateEmailRequests = [];

    findValidateEmailRequests.call({
        findConditions: {
            email: emailID,
            user: userID
        }
    }, validateEmailRequests, function (err, validateEmailRequests) {
        if (err) {
            return cb(err);
        }

        assert.strictEqual(validateEmailRequests.length, 1);

        cb();
    });
};
    
describe('POST /users/:user_id/emails/:email_id/validate', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, userID, emailID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .post('/users/' + userID 
                              + '/emails/' 
                              + (this.wrongEmailID || emailID) 
                              + '/validate')
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
                    return cb(null, this.accessToken, this.userID, this.emailID);
                }

                createEmail(cb);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);

            getAppAccessToken = getAppAccessToken(app);
            createEmail = createEmail(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: userID,
                emailID: emailID
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                emailID: emailID
            }, 400, {}, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 400, {}, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    // Client use this method so don't test
    // for non app access token
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'unauth-app token try to validate user email', function (done) {

        getUnauthenticatedAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                userID: mongoose.Types.ObjectId().toString(),
                emailID: mongoose.Types.ObjectId().toString()
            }, 403, {}, /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to validate user email which does not belong to him', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to validate user email which does not exist', function (done) {

        makeARequest.call({
            wrongEmailID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'email is already validated', function (done) {

        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, accessToken, userID, emailID, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        emailID: emailID,
                        email: email
                    });
                });
            },

            validateEmail: ['createEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                
                var accessToken = createEmailResp.accessToken;
                var userID = createEmailResp.userID;
                
                var emailID = createEmailResp.emailID;
                var email = createEmailResp.email;

                var emailLink = config.EVENID_APP.ENDPOINT 
                                + '/users/' 
                                + userID
                                + '/emails/' 
                                + emailID
                                + '/validate/' 
                                + validateEmailCode;

                var mockScopes = userEmailValidateMock(
                    [email, emailLink, emailLink, config.EVENID_APP.NAME],
                    config.EVENID_APP.NAME,
                    config.EVENID_APP.LOGO, 
                    emailLink,
                    email
                );

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 200, {}, successReg, function (err, resp) {
                    if (err) {
                        return done(err);
                    }

                    mockScopes.forEach(function (mockScope) {
                        assert.ok(mockScope.isDone());
                    });

                    done();
                });
            }],

            assertEmailCannotBeValidated: ['validateEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var accessToken = createEmailResp.accessToken;
                var userID = createEmailResp.userID;
                var emailID = createEmailResp.emailID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 403, {}, /access_denied/, done);
            }]
        }, function (err) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'too many validate email requests were made', function (done) {

        var oldValue = config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                             .MAX_ATTEMPTS;

        config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
              .MAX_ATTEMPTS = 0;

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return cb(err);
            }

            makeARequest(403, {}, 
                         /(?=.*access_denied)(?=.*You have reached the maximum number)/, 
                         function (err, resp) {
                
                if (err) {
                    return done(err);
                }

                config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                      .MAX_ATTEMPTS = oldValue;

                done();
            });
        });
    });

    it('responds with HTTP code 200 with client access token', function (done) {
        getOauthClientAccessToken.call({
            // We need fake user and email ID
            userAsViewedByClient: true
        }, function (err, resp) {
            var emailLink = null;
            var mockScopes = [];

            if (err) {
                return done(err);
            }

            emailLink = config.EVENID_APP.ENDPOINT 
                            + '/users/' 
                            + resp.realUser.id
                            + '/emails/' 
                            + resp.realUser.emails[0].id
                            + '/validate/' 
                            + validateEmailCode;

            mockScopes = userEmailValidateMock(
                [resp.user.emails[0].address, emailLink, emailLink, resp.client.name],
                resp.client.name,
                resp.client.logo, 
                emailLink,
                resp.user.emails[0].address
            );

            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.user.id,
                emailID: resp.user.emails[0].id
            }, 200, {}, '{"status":"ok"}', function (err, _resp) {
                if (err) {
                    return done(err);
                }

                mockScopes.forEach(function (mockScope) {
                    assert.ok(mockScope.isDone());
                });

                assertValidateEmailRequestIsCreated(resp.realUser.emails[0].id,
                                                    resp.realUser.id,
                                                    done);
            });
        });
    });

    it('responds with HTTP code 200 with app access token', function (done) {
        createEmail(function (err, accessToken, userID, emailID, email) {
            var emailLink = null;
            var mockScopes = [];

            if (err) {
                return done(err);
            }

            emailLink = config.EVENID_APP.ENDPOINT 
                            + '/users/' 
                            + userID
                            + '/emails/' 
                            + emailID
                            + '/validate/' 
                            + validateEmailCode;

            mockScopes = userEmailValidateMock(
                [email, emailLink, emailLink, config.EVENID_APP.NAME],
                config.EVENID_APP.NAME,
                config.EVENID_APP.LOGO, 
                emailLink,
                email
            );

            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                emailID: emailID
            }, 200, {}, successReg, function (err, resp) {
                if (err) {
                    return done(err);
                }

                mockScopes.forEach(function (mockScope) {
                    assert.ok(mockScope.isDone());
                });

                assertValidateEmailRequestIsCreated(emailID, userID, done);
            });
        });
    });
});