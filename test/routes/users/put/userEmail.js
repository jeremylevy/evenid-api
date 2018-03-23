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

var findEmails = require('../../../../testUtils/db/findEmails');
var findMainEmailAddresses = require('../../../../testUtils/db/findMainEmailAddresses');

var updateEmail = require('../../../../testUtils/db/updateEmail');

var makeARequest = null;
var app = null;

var validEmail = function () {
    return mongoose.Types.ObjectId().toString() + '@evenid.com';
};

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                          + '(?=.*email)(?=.*is_verified)'
                          + '(?=.*is_main_address)'
                          + '(?!.*"_id")(?!.*"__v")');
    
describe('PUT /users/:user_id/emails/:email_id', function () {
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
                        .put('/users/' + userID 
                             + '/emails/' 
                             + (this.wrongEmailID || emailID))
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
                        .set('Authorization', authHeader)
                        .send(data)
                        .expect('Content-Type', 'application/json; charset=utf-8')
                        .expect('Cache-Control', 'no-store')
                        .expect('Pragma', 'no-cache')
                        .expect(body)
                        .expect(statusCode, done);
                }.bind(this);

                if (this.userID) {
                    return cb(null, this.accessToken, this.userID, this.emailID);
                }

                createEmail(cb);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);
            createEmail = createEmail(app, getAppAccessToken);

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
                emailID: emailID
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createEmail(function (err, accessToken, userID, emailID) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                emailID: emailID
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
                    emailID: emailID
                }, 403, {
                    email: validEmail()
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to update user email which does not belong to him', function (done) {

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
                }, 403, {
                   email: validEmail()
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to modify user email which does not exist', function (done) {

        makeARequest.call({
            wrongEmailID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {
            email: validEmail()
            // Positive lookahead assertion
        }, /access_denied/, done);
    });

    it('responds with HTTP code 400 and `invalid_request`'
       + ' error when invalid email', function (done) {

        createEmail(function (err, accessToken, userID, emailID, email, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                emailID: emailID
            }, 400, {
                email: 'bar',
                password: user.password
                // Positive lookahead assertion
            }, /(?=.*invalid_request)(?=.*email)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid email length', function (done) {

        createEmail(function (err, accessToken, userID, emailID, email, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                emailID: emailID
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

    it('responds with HTTP code 400 and `invalid_request`'
       + ' error when invalid password', function (done) {

        createEmail(function (err, accessToken, userID, emailID, email, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                emailID: emailID
            }, 400, {
                email: validEmail(),
                password: ''
                // Positive lookahead assertion
            }, /(?=.*invalid_request)(?=.*password)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request`'
       + ' error when invalid email and password', function (done) {

        createEmail(function (err, accessToken, userID, emailID, email, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                emailID: emailID
            }, 400, {
                email: 'bar',
                password: ''
                // Positive lookahead assertion
            }, /(?=.*invalid_request)(?=.*email)(?=.*password)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request`'
       + ' error when user unsets main address flag', function (done) {

        createEmail.call({
            is_main_address: 'true'
        }, function (err, accessToken, userID, emailID, email, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                emailID: emailID
            }, 400, {
                email: validEmail(),
                password: user.password,
                is_main_address: 'false'
                // Positive lookahead assertion
            }, /(?=.*invalid_request)(?=.*is_main_address)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request`'
       + ' error when email is already used', function (done) {

        createEmail(function (err, accessToken, userID, emailID, firstCreatedEmail) {
            if (err) {
                return done(err);
            }

            // We cannot update the same email 
            // to trigger the unique index error
            createEmail(function (err, accessToken, userID, emailID, email, user) {
                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 400, {
                    email: firstCreatedEmail,
                    password: user.password
                    // Positive lookahead assertion
                }, /(?=.*invalid_request)(?=.*email)/, done);
            });
        });
    });

    it('responds with HTTP code 200 and does not update '
       + '`is_verified` flag when email address was not updated', function (done) {

        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, accessToken, userID, emailID, email, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        user: user,
                        emailID: emailID,
                        email: email
                    });
                });
            },

            verifyEmail: ['createEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var emailID = createEmailResp.emailID;

                updateEmail({
                    _id: emailID
                }, {
                    is_verified: true
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            updateEmail: ['verifyEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var accessToken = createEmailResp.accessToken;
                var userID = createEmailResp.userID;
                var emailID = createEmailResp.emailID;
                var userPassword = createEmailResp.user.password;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 200, {
                    password: userPassword,
                    // We don't update email address
                    is_main_address: 'true'
                }, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp.body);
                });
            }],

            assertEmailWasUpdated: ['updateEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var emailID = createEmailResp.emailID;

                findEmails([emailID], function (err, emails) {
                    var email = emails[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    // Assert `is_verified` remains equal to `true`
                    // given that we have not updated the email address
                    assert.strictEqual(email.is_verified, true);

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

    it('responds with HTTP code 200 and does not change main email '
       + 'address when `is_main_address` flag was set to `false`', function (done) {

        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, accessToken, userID, emailID, email, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        user: user,
                        emailID: emailID,
                        email: email
                    });
                });
            },

            updateEmail: ['createEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var accessToken = createEmailResp.accessToken;
                var userID = createEmailResp.userID;
                var emailID = createEmailResp.emailID;
                var userPassword = createEmailResp.user.password;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 200, {
                    password: userPassword,
                    // We set `is_main_address` flag to `false`
                    is_main_address: 'false'
                }, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp.body);
                });
            }],

            assertEmailWasUpdated: ['updateEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var emailID = createEmailResp.emailID;

                findEmails([emailID], function (err, emails) {
                    var email = emails[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    // Assert it was not updated
                    assert.strictEqual(email.is_main_address, false);

                    cb();
                });
            }],

            assertMainEmailAddressIsSet: ['updateEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var userID = createEmailResp.userID;
                var emailID = createEmailResp.emailID;

                findMainEmailAddresses(userID, function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    // We must have only one 
                    // main email address by user
                    assert.strictEqual(emails.length, 1);

                    // Make sure updated email was not main address
                    assert.notEqual(emails[0].id, emailID);

                    cb();
                })
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 200 and email when '
       + 'valid email infos', function (done) {

        var updatedEmail = {
            email: validEmail(),
            is_main_address: 'true'
        };

        var assertEmailWasUpdated = function (email, updatedEmail) {
            assert.strictEqual(email.email || email.address, updatedEmail.email);

            // Assert `is_verified` was set 
            // to `false` given that we have updated email address
            assert.strictEqual(email.is_verified, false);
            assert.strictEqual(email.is_main_address, true);
        };

        async.auto({
            // User starts with one email
            // set as main address
            createEmail: function (cb) {
                createEmail(function (err, accessToken, userID, emailID, email, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        user: user,
                        emailID: emailID,
                        email: email
                    });
                });
            },

            updateEmail: ['createEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var accessToken = createEmailResp.accessToken;
                var userID = createEmailResp.userID;
                var emailID = createEmailResp.emailID;
                var userPassword = createEmailResp.user.password;
                var update = {
                    password: userPassword
                };

                // Make a copy to avoid setting user password
                Object.keys(updatedEmail).forEach(function (key) {
                    update[key] = updatedEmail[key];
                });

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 200, update, successReg, function (err, resp) {
                    var email = resp && resp.body;
                    
                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns updated email
                    assertEmailWasUpdated(email, updatedEmail);

                    cb(null, email);
                });
            }],

            assertEmailWasUpdated: ['updateEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var emailID = createEmailResp.emailID;

                findEmails([emailID], function (err, emails) {
                    var email = emails[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    assertEmailWasUpdated(email, updatedEmail);

                    cb();
                });
            }],

            /* Make sure email updated with `is_main_address`
               flag is set as main address for user */
            assertMainEmailAddressIsSet: ['updateEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var userID = createEmailResp.userID;
                var emailID = createEmailResp.emailID;

                findMainEmailAddresses(userID, function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    // We must have only one 
                    // main email address by user
                    assert.strictEqual(emails.length, 1);
                    assert.strictEqual(emails[0].id, emailID);

                    cb();
                })
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});