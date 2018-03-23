var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var createPhoneNumber = require('../../../../testUtils/users/createPhoneNumber');
var findPhoneNumbers = require('../../../../testUtils/db/findPhoneNumbers');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

describe('DELETE /users/:user_id/phone-numbers/:phone_number_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, userID, phoneNumberID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .delete('/users/' + (this.wrongUserID || userID) 
                                + '/phone-numbers/' 
                                + (this.wrongPhoneNumberID || phoneNumberID))
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
                    return cb(null, this.accessToken, this.userID, this.phoneNumberID);
                }

                createPhoneNumber(cb);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);
            createPhoneNumber = createPhoneNumber(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: userID,
                phoneNumberID: phoneNumberID
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                phoneNumberID: phoneNumberID
            }, 400, {}, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
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
                    phoneNumberID: phoneNumberID
                }, 400, {}, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
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
                    phoneNumberID: phoneNumberID
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to delete phone number', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
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
                    phoneNumberID: phoneNumberID
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete phone number for invalid user', function (done) {

        makeARequest.call({
            wrongUserID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to delete phone number which does not belong to him', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
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
                    phoneNumberID: phoneNumberID
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete invalid phone number', function (done) {

        makeARequest.call({
            wrongPhoneNumberID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete phone number used by clients', function (done) {

        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: resp.appAccessToken,
                userID: resp.user.id,
                phoneNumberID: resp.user.phone_numbers[0].id
            }, 403, {}, /access_denied/, done);
        });
    });

    it('responds with HTTP code 200 when '
       + 'deleting valid phone number', function (done) {

        async.auto({
            createPhoneNumber: function (cb) {
                createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        phoneNumberID: phoneNumberID
                    });
                });
            },

            assertPhoneNumberWasCreated: ['createPhoneNumber', function (cb, results) {
                var createPhoneNumberResp = results.createPhoneNumber;
                var phoneNumberID = createPhoneNumberResp.phoneNumberID;
                
                findPhoneNumbers([phoneNumberID], function (err, phoneNumbers) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(phoneNumbers.length, 1);

                    cb();
                });
            }],

            deletePhoneNumber: ['assertPhoneNumberWasCreated', function (cb, results) {
                var createPhoneNumberResp = results.createPhoneNumber;
                var userID = createPhoneNumberResp.userID;
                var accessToken = createPhoneNumberResp.accessToken;
                var phoneNumberID = createPhoneNumberResp.phoneNumberID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    phoneNumberID: phoneNumberID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertPhoneNumberWasDeleted: ['deletePhoneNumber', function (cb, results) {
                var createPhoneNumberResp = results.createPhoneNumber;
                var phoneNumberID = createPhoneNumberResp.phoneNumberID;

                findPhoneNumbers([phoneNumberID], function (err, phoneNumbers) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(phoneNumbers.length, 0);

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