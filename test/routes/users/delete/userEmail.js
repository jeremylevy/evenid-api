var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var createEmail = require('../../../../testUtils/users/createEmail');
var findEmails = require('../../../../testUtils/db/findEmails');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

describe('DELETE /users/:user_id/emails/:email_id', function () {
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
                        .delete('/users/' + (this.wrongUserID || userID) 
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
            if (err) {
                return done(err);
            }

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
       + 'non-app token try to delete email', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete email for invalid user', function (done) {

        makeARequest.call({
            wrongUserID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to delete email which does not belong to him', function (done) {

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
       + 'attempt to delete invalid email', function (done) {

        makeARequest.call({
            wrongEmailID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete main email address', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                userID: user.id,
                emailID: user.emails[0].id
            }, 403, {}, /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete email address used by clients', function (done) {

        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: resp.appAccessToken,
                userID: resp.user.id,
                emailID: resp.user.emails[0].id
            }, 403, {}, /access_denied/, done);
        });
    });

    it('responds with HTTP code 200 when '
       + 'deleting valid email', function (done) {

        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, accessToken, userID, emailID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        emailID: emailID
                    });
                });
            },

            assertEmailWasCreated: ['createEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var emailID = createEmailResp.emailID;
                
                findEmails([emailID], function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    cb();
                });
            }],

            deleteEmail: ['assertEmailWasCreated', function (cb, results) {
                var createEmailResp = results.createEmail;
                var userID = createEmailResp.userID;
                var accessToken = createEmailResp.accessToken;
                var emailID = createEmailResp.emailID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    emailID: emailID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertEmailWasDeleted: ['deleteEmail', function (cb, results) {
                var createEmailResp = results.createEmail;
                var emailID = createEmailResp.emailID;

                findEmails([emailID], function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 0);

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