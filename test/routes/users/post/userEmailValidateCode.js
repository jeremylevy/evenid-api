var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var createEmail = require('../../../../testUtils/users/createEmail');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var createValidateEmailRequest = require('../../../../testUtils/users/createValidateEmailRequest');
var expireValidateEmailRequest = require('../../../../testUtils/db/expireValidateEmailRequest');
var updateValidateEmailRequest = require('../../../../testUtils/db/updateValidateEmailRequest');

var findEmails = require('../../../../testUtils/db/findEmails');
var findValidateEmailRequests = require('../../../../testUtils/db/findValidateEmailRequests');

var updateEmail = require('../../../../testUtils/db/updateEmail');

var makeARequest = null;
var app = null;

var validCode = '602c57ffb51af99d6f3b54c0ee9587bb110fb990';
var invalidCode = 'afba34a2a11ab13eeba5d0a7aa22bbb6120e177b';

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                          + '(?=.*email)(?=.*is_verified)'
                          + '(?=.*is_main_address)'
                          + '(?!.*"_id")(?!.*"__v")'
                          + '(?!.*_oauth_entities_id)'
                          + '(?!.*_granted_authorizations)');

var assertEmailIsValidated = function (validateEmailRequestID, emailID, cb) {
    async.auto({
        assertEmailWasUpdated: function (cb) {
            findEmails([emailID], function (err, emails) {
                var email = emails[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(emails.length, 1);

                assert.strictEqual(email.is_verified, true);

                cb();
            });
        },

        assertRequestWasDeleted: function (cb) {
            findValidateEmailRequests([validateEmailRequestID], 
                                      function (err, validateEmailRequests) {
        
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(validateEmailRequests.length, 0);

                cb();
            });
        }
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null, results);
    });
};
    
describe('POST /users/:user_id/emails/:email_id/validate/:code', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, userID, emailID, code) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .post('/users/' + userID 
                              + '/emails/' + (this.wrongEmailID || emailID) 
                              + '/validate/' + (this.invalidCode || code))
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
                    return cb(null, this.accessToken, this.userID, this.emailID, this.code);
                }

                createValidateEmailRequest(function (err, accessToken, 
                                                     userID, emailID, 
                                                     validateEmailRequest) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, userID, 
                       emailID, validateEmailRequest.code);
                });
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);
            createEmail = createEmail(app, getAppAccessToken);
            createValidateEmailRequest = createValidateEmailRequest(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: userID,
                emailID: emailID,
                code: validCode
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                emailID: emailID,
                code: validCode
            }, 400, {}, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

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
                    emailID: emailID,
                    code: validCode
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
                    emailID: emailID,
                    code: validCode
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to update user email', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID,
                    code: validCode
                }, 403, {
                    email: mongoose.Types.ObjectId().toString() + '@evenid.com'
                }, /access_denied/, done);
            });
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
                    emailID: emailID,
                    code: validCode
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
       + 'user try to use invalid code', function (done) {

        makeARequest.call({
            invalidCode: invalidCode
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use code not attached to emails', function (done) {

        async.auto({
            createValidateEmailRequest: function (cb) {
                createValidateEmailRequest(function (err, accessToken, 
                                                     userID, emailID, 
                                                     validateEmailRequest) {
            
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        emailID: emailID,
                        validateEmailRequest: validateEmailRequest
                    });
                });
            },

            updateValidateEmailRequest: ['createValidateEmailRequest', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                updateValidateEmailRequest({
                    code: validateEmailRequest.code
                }, {
                    email: mongoose.Types.ObjectId().toString()
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            tryToValidateEmail: ['updateValidateEmailRequest', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                makeARequest.call({
                    invalidCode: validateEmailRequest.code
                }, 403, {}, /access_denied/, function (err, resp) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRequestWasDeleted: ['tryToValidateEmail', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                findValidateEmailRequests([validateEmailRequest.id], 
                                          function (err, validateEmailRequests) {
            
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(validateEmailRequests.length, 0);

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

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to use expired code', function (done) {

        async.auto({
            createValidateEmailRequest: function (cb) {
                createValidateEmailRequest(function (err, accessToken, 
                                                     userID, emailID, 
                                                     validateEmailRequest) {
            
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        emailID: emailID,
                        validateEmailRequest: validateEmailRequest
                    });
                });
            },

            expireValidateEmailRequest: ['createValidateEmailRequest', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                expireValidateEmailRequest(validateEmailRequest.code, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            tryToValidateEmail: ['expireValidateEmailRequest', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                makeARequest.call({
                    invalidCode: validateEmailRequest.code
                }, 403, {}, /access_denied/, function (err, resp) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRequestWasDeleted: ['tryToValidateEmail', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                findValidateEmailRequests([validateEmailRequest.id], 
                                          function (err, validateEmailRequests) {
            
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(validateEmailRequests.length, 0);

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

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user email is already verifed', function (done) {

        async.auto({
            createValidateEmailRequest: function (cb) {
                createValidateEmailRequest(function (err, accessToken, 
                                                     userID, emailID, 
                                                     validateEmailRequest) {
            
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        emailID: emailID,
                        validateEmailRequest: validateEmailRequest
                    });
                });
            },

            verifyEmail: ['createValidateEmailRequest', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var emailID = createValidateEmailRequestResp.emailID;

                updateEmail({
                    _id: emailID
                }, {
                    is_verified: true
                }, function (err, updatedEmail) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedEmail);
                });
            }],

            tryToValidateEmail: ['verifyEmail', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                makeARequest.call({
                    invalidCode: validateEmailRequest.code
                }, 403, {}, /access_denied/, function (err, resp) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRequestWasDeleted: ['tryToValidateEmail', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;

                findValidateEmailRequests([validateEmailRequest.id], 
                                          function (err, validateEmailRequests) {
            
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(validateEmailRequests.length, 0);

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

    it('responds with HTTP code 200 when valid code', function (done) {
        async.auto({
            createValidateEmailRequest: function (cb) {
                createValidateEmailRequest(function (err, accessToken, 
                                                     userID, emailID, 
                                                     validateEmailRequest) {
            
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        emailID: emailID,
                        validateEmailRequest: validateEmailRequest
                    });
                });
            },

            validateEmail: ['createValidateEmailRequest', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var accessToken = createValidateEmailRequestResp.accessToken;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;
                var emailID = createValidateEmailRequestResp.emailID;
                var userID = createValidateEmailRequestResp.userID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID,
                    code: validateEmailRequest.code
                }, 200, {}, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            assertEmailIsValidated: ['validateEmail', function (cb, results) {
                var createValidateEmailRequestResp = results.createValidateEmailRequest;
                var validateEmailRequest = createValidateEmailRequestResp.validateEmailRequest;
                var emailID = createValidateEmailRequestResp.emailID;

                assertEmailIsValidated(validateEmailRequest.id, emailID, cb);
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});