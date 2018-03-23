var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findUsers = require('../../../../testUtils/db/findUsers');

var findPhoneNumbers = require('../../../../testUtils/db/findPhoneNumbers');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                          + '(?=.*number)(?=.*country)'
                          + '(?=.*phone_type)(?=.*international_number)'
                          + '(?!.*"_id")(?!.*"__v")');

var validPhoneNumber = function () {
    return {
        // API returns number with spaces
        // so ease the assert process
        number: '04 89 09 37 48',
        country: 'FR'
    };
};
    
describe('POST /users/:user_id/phone-numbers', function () {
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
                              + '/phone-numbers')
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
       + 'non-app token try to create user phone number', function (done) {

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
       + 'attempt to create phone number for user which does not belong to him', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: '507c7f79bcf86cd7994f6c0e'
            }, 403, validPhoneNumber(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when user '
       + 'has reached the maximum number  of phone numbers allowed', function (done) {

        var oldLimit = config.EVENID_USERS.MAX_ENTITIES.PHONE_NUMBERS;
        var errorReg = new RegExp('access_denied'
                                + '.*'
                                + 'You have reached the maximum number of '
                                + 'phone numbers allowed per user\\.');

        // Node.JS cache required modules, so config object is always the SAME
        config.EVENID_USERS.MAX_ENTITIES.PHONE_NUMBERS = 0;

        makeARequest(403, validPhoneNumber(), errorReg, function (err, resp) {
            config.EVENID_USERS.MAX_ENTITIES.PHONE_NUMBERS = oldLimit;

            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid phone number', function (done) {

        makeARequest(400, {
            number: '09S',
            country: 'FR'
            // Positive lookahead assertion
        }, /(?=.*invalid_request)(?=.*number)/, done);
    });

    it('responds with HTTP code 200 and phone number when '
       + 'valid phone number infos', function (done) {

        var assertPhoneNumberWasCreated = function (phoneNumber, insertedPhoneNumber) {
            Object.keys(insertedPhoneNumber).forEach(function (key) {
                assert.strictEqual(phoneNumber[key], insertedPhoneNumber[key]);
            });
        };

        async.auto({
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

            createPhoneNumber: ['getAppAccessToken', function (cb, results) {
                var getAppAccessTokenResp = results.getAppAccessToken;
                var insertedPhoneNumber = validPhoneNumber();

                makeARequest.call({
                    accessToken: getAppAccessTokenResp.accessToken,
                    userID: getAppAccessTokenResp.user.id
                }, 200, insertedPhoneNumber, successReg, function (err, resp) {
                    var phoneNumber = resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns created phone number
                    assertPhoneNumberWasCreated(phoneNumber, insertedPhoneNumber);

                    cb(null, resp.body);
                });
            }],

            assertPhoneNumberWasCreated: ['createPhoneNumber',
                                          function (cb, results) {
                
                var phoneNumber = results.createPhoneNumber;
                var insertedPhoneNumber = validPhoneNumber();

                findPhoneNumbers([phoneNumber.id], function (err, phoneNumbers) {
                    var phoneNumber = phoneNumbers[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(phoneNumbers.length, 1);

                    assertPhoneNumberWasCreated(phoneNumber, insertedPhoneNumber);

                    cb();
                });
            }],

            // Make sure user phone numbers
            // property was updated
            assertUserWasUpdated: ['createPhoneNumber', 
                                   function (cb, results) {
                
                var getAppAccessTokenResp = results.getAppAccessToken;
                var phoneNumber = results.createPhoneNumber;

                findUsers([getAppAccessTokenResp.user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    assert.strictEqual(user.phone_numbers.length, 1);
                    assert.strictEqual(user.phone_numbers[0].toString(), phoneNumber.id);

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