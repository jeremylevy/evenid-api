var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');
var oauthAuthorizeBeforeHook = require('../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var createPhoneNumber = require('../../../../testUtils/users/createPhoneNumber');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findPhoneNumbers = require('../../../../testUtils/db/findPhoneNumbers');
var removePhoneNumbers = require('../../../../testUtils/db/removePhoneNumbers');

var findOauthEntitiesID = require('../../../../testUtils/db/findOauthEntitiesID');

var compareArray = require('../../../../testUtils/lib/compareArray');

var makeARequest = null;
var app = null;

var testForPhoneAskedByClient = function (scopeFlags, update, cb) {
    var context = this;

    async.auto({
        // First, we authorize access to phone number
        // for one client
        getOauthClientAccessToken: function (cb) {
            getOauthClientAccessToken.call({
                redirectionURIScope: ['phone_numbers'],
                redirectionURIScopeFlags: scopeFlags
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        },

        // We want to authorize the same phone number for another 
        // client to test for multiple entities ID update
        oauthAuthorizeBeforeHook: ['getOauthClientAccessToken', function (cb, results) {
            var resp = results.getOauthClientAccessToken;

            oauthAuthorizeBeforeHook.call({
                user: resp.user,
                accessToken: resp.appAccessToken
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Make sure we authorize the same number
                // No matter asked phone type
                resp.validFormData = function () {
                    return {
                        phone_number: resp.user.phone_numbers[0].id,
                        mobile_phone_number: resp.user.phone_numbers[0].id,
                        landline_phone_number: resp.user.phone_numbers[0].id
                    };
                };

                cb(null, resp);
            });
        }],

        // We authorize access to the same 
        // phone number for another client
        getOauthClientAccessToken2: ['oauthAuthorizeBeforeHook', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: resp,
                redirectionURIScope: ['phone_numbers'],
                redirectionURIScopeFlags: scopeFlags
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        }]
    }, function (err, results) {
        var resp = results.getOauthClientAccessToken;

        var appAccessToken = resp && resp.appAccessToken;
        var userID = resp && resp.user.id;
        var phoneNumberID = resp && resp.user.phone_numbers[0].id;

        if (err) {
            return cb(err);
        }

        makeARequest.call({
            accessToken: appAccessToken,
            userID: userID,
            phoneNumberID: phoneNumberID
        }, context.expectedStatusCode || 400,
        update, context.expectedBody || /(?=.*error)(?=.*number)/, cb);
    });
};

var assertPhoneTypeWasConserved = function (expectedPhoneType) {
    return function (err, resp, cb) {
        var phoneNumberID = resp && resp.body.id;

        if (err) {
            return cb(err);
        }

        findPhoneNumbers([phoneNumberID], function (err, phoneNumbers) {
            var phoneNumber = phoneNumbers[0];

            if (err) {
                return cb(err);
            }

            assert.strictEqual(phoneNumbers.length, 1);

            assert.strictEqual(phoneNumber.phone_type, expectedPhoneType);

            cb();
        });
    };
};

var assertOauthEntitiesIDWereUpdated = function (phoneNumberID, expectedEntities, cb) {
    findOauthEntitiesID({
        real_id: phoneNumberID
    }, function (err, oauthEntitiesID) {
        if (err) {
            return cb(err);
        }

        // We have authorized two clients
        assert.strictEqual(oauthEntitiesID.length, 2);

        oauthEntitiesID.forEach(function (oauthEntityID) {
            assert.ok(compareArray(oauthEntityID.entities,
                                   expectedEntities));
        });

        cb();
    });
};

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                          + '(?=.*number)(?=.*phone_type)'
                          + '(?=.*country)(?=.*international_number)'
                          + '(?!.*"_id")(?!.*"__v")');
    
describe('PUT /users/:user_id/phone-numbers/:phone_number_id', function () {
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
                        .put('/users/' + userID 
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
       + 'non-app token try to update user phone number', function (done) {

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
                }, 403, {
                    number: '0498394059'
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to update user phone number which does not belong to him', function (done) {

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
                }, 403, {
                    number: '0498394059'
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to modify user phone number which does not exist', function (done) {

        makeARequest.call({
            wrongPhoneNumberID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {
            number: '0498394059'
            // Positive lookahead assertion
        }, /access_denied/, done);
    });

    it('responds with HTTP code 404 and `not_found` error when '
       + 'attempt to modify owned user phone number which does not exist', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
            if (err) {
                return done(err);
            }

            removePhoneNumbers([phoneNumberID], function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    phoneNumberID: phoneNumberID
                }, 404, {
                    number: '0498394059'
                }, /not_found/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid number', function (done) {

        makeARequest(400, {
            number: 'bar'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*number)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid phone type', function (done) {

        makeARequest(400, {
            phone_type: 'bar'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*phone_type)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid country', function (done) {

        makeARequest(400, {
            country: 'bar'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*country)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid number for country', function (done) {

        makeARequest(400, {
            number: '04 91 39 40 59',
            country: 'US'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*number)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid phone type for number', function (done) {

        makeARequest(400, {
            number: '04 91 39 40 59',
            phone_type: 'mobile',
            country: 'FR'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*number)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when phone type was set to landline for a mobile '
       + 'phone number asked by client', function (done) {

        var scopeFlags = ['mobile_phone_number'];
        var update = {
            number: '04 91 37 48 37',
            country: 'FR'
        };

        testForPhoneAskedByClient(scopeFlags, update,
                                  function (err, resp) {
            if (err) {
                return done(err);
            }

            update.phone_type = 'landline';

            // Also test when phone type was explicitly set
            testForPhoneAskedByClient(scopeFlags, update, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when phone type was set to mobile for a landline '
       + 'phone number asked by client', function (done) {

        var scopeFlags = ['landline_phone_number'];
        var update = {
            number: '06 19 39 48 20',
            country: 'FR'
        };

        testForPhoneAskedByClient(scopeFlags, update,
                                  function (err, resp) {
            if (err) {
                return done(err);
            }

            update.phone_type = 'mobile';

            // Also test when phone type was explicitly set
            testForPhoneAskedByClient(scopeFlags, update, done);
        });
    });

    it('responds with HTTP code 200 when phone type was set to '
       + 'unknown for a mobile phone number asked by client', function (done) {

        var scopeFlags = ['mobile_phone_number'];
        var update = {
            number: '732-757-2923',
            country: 'US'
        };

        testForPhoneAskedByClient.call({
            expectedStatusCode: 200,
            expectedBody: successReg
        }, scopeFlags, update, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertPhoneTypeWasConserved('mobile')(err, resp, function (err) {
                if (err) {
                    return done(err);
                }

                update.phone_type = 'unknown';

                // Also test when phone 
                // type was explicitly set
                testForPhoneAskedByClient.call({
                    expectedStatusCode: 200,
                    expectedBody: successReg
                }, scopeFlags, update, function (err, resp) {
                    assertPhoneTypeWasConserved('mobile')(err, resp, done);
                });
            });
        });
    });

    it('responds with HTTP code 200 when phone type was set to '
       + 'unknown for a landline phone number asked by client', function (done) {

        var scopeFlags = ['landline_phone_number'];
        var update = {
            number: '732-757-2923',
            country: 'US'
        };

        testForPhoneAskedByClient.call({
            expectedStatusCode: 200,
            expectedBody: successReg
        }, scopeFlags, update, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertPhoneTypeWasConserved('landline')(err, resp, function (err) {
                if (err) {
                    return done(err);
                }

                update.phone_type = 'unknown';

                // Also test when phone 
                // type was explicitly set
                testForPhoneAskedByClient.call({
                    expectedStatusCode: 200,
                    expectedBody: successReg
                }, scopeFlags, update, function (err, resp) {
                    assertPhoneTypeWasConserved('landline')
                                               (err, resp, done);
                });
            });
        });
    });

    it('responds with HTTP code 200 when phone type was set to '
       + 'mobile for an unknown phone number asked by client', function (done) {

        var scopeFlags = [];
        var update = {
            number: '06 19 39 48 20',
            country: 'FR'
        };

        testForPhoneAskedByClient.call({
            expectedStatusCode: 200,
            expectedBody: successReg
        }, scopeFlags, update, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertOauthEntitiesIDWereUpdated(resp.body.id, 
                                             ['unknown_phone_numbers',
                                              'mobile_phone_numbers'],
                                             function (err) {
                if (err) {
                    return done(err);
                }

                update.phone_type = 'unknown';

                // Also test when phone 
                // type was explicitly set
                testForPhoneAskedByClient.call({
                    expectedStatusCode: 200,
                    expectedBody: successReg
                }, scopeFlags, update, function (err, resp) {
                    assertOauthEntitiesIDWereUpdated(resp.body.id, 
                                                     ['unknown_phone_numbers',
                                                      'mobile_phone_numbers'],
                                                    done);
                });
            });
        });
    });

    it('responds with HTTP code 200 when phone type was set to '
       + 'landline for an unknown phone number asked by client', function (done) {

        var scopeFlags = [];
        var update = {
            number: '04 91 37 48 37',
            country: 'FR'
        };

        testForPhoneAskedByClient.call({
            expectedStatusCode: 200,
            expectedBody: successReg
        }, scopeFlags, update, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertOauthEntitiesIDWereUpdated(resp.body.id, 
                                            ['unknown_phone_numbers',
                                             'landline_phone_numbers'],
                                            function (err) {
                if (err) {
                    return done(err);
                }

                update.phone_type = 'landline';

                // Also test when phone 
                // type was explicitly set
                testForPhoneAskedByClient.call({
                    expectedStatusCode: 200,
                    expectedBody: successReg
                }, scopeFlags, update, function (err, resp) {
                    assertOauthEntitiesIDWereUpdated(resp.body.id, 
                                                     ['unknown_phone_numbers',
                                                      'landline_phone_numbers'],
                                                     done);
                });
            });
        });
    });

    // Added after a bug which prevented 
    // phone number to be updated when 
    // phone type have to be changed automatically
    // by changing number
    it('responds with HTTP code 200 and phone number '
       + 'when phone type was updated automatically', function (done) {

        createPhoneNumber.call({
            dataToSend: {
                phone_type: 'landline',
                number: '04 91 37 48 37',
                country: 'FR'
            }
        }, function (err, accessToken, userID, phoneNumberID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                userID: userID,
                phoneNumberID: phoneNumberID
            }, 200, {
                number: '06 23 35 43 78',
                // `phone_type` was not set because, 
                // error arise when it was updated automatically
                // by changing number
            }, successReg, done);
        });
    });

    it('responds with HTTP code 200 and phone '
       + 'number when valid phone number infos', function (done) {

        var updatedPhoneNumber = {
            // API returns number with spaces
            // so ease the assert process
            number: '04 91 39 40 59',
            phone_type: 'landline',
            country: 'FR'
        };

        var assertPhoneNumberWasUpdated = function (phoneNumber, updatedPhoneNumber) {
            Object.keys(updatedPhoneNumber).forEach(function (key) {
                assert.strictEqual(phoneNumber[key], updatedPhoneNumber[key]);
            });
        };
        
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

            updatedPhoneNumber: ['createPhoneNumber', function (cb, results) {
                var createPhoneNumberResp = results.createPhoneNumber;
                var accessToken = createPhoneNumberResp.accessToken;
                var userID = createPhoneNumberResp.userID;
                var phoneNumberID = createPhoneNumberResp.phoneNumberID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    phoneNumberID: phoneNumberID
                }, 200, updatedPhoneNumber, successReg, function (err, resp) {
                    var phoneNumber = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns updated phone number
                    assertPhoneNumberWasUpdated(phoneNumber, updatedPhoneNumber);

                    cb();
                });
            }],

            assertPhoneNumberWasUpdated: ['updatedPhoneNumber', function (cb, results) {
                var createPhoneNumberResp = results.createPhoneNumber;
                var phoneNumberID = createPhoneNumberResp.phoneNumberID;

                findPhoneNumbers([phoneNumberID], function (err, phoneNumbers) {
                    var phoneNumber = phoneNumbers[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(phoneNumbers.length, 1);

                    assertPhoneNumberWasUpdated(phoneNumber, updatedPhoneNumber);

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