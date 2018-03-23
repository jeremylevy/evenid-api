var request = require('supertest');
var assert = require('assert');

var async = require('async');

var config = require('../../../../../config');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;

var testForPhoneTypeUpdate = function (scopeFlags, update, cb) {
    var context = this;
    var getUser = function (resp, cb) {
        var app = resp.app;
        var accessToken = resp && resp.accessToken;
        var userID = resp && resp.fakeUserID;

        makeARequest(app, accessToken, userID, 200, function (err, resp) {
            if (err) {
                return cb(err);
            }

            cb(null, resp);
        });
    };

    async.auto({
        // First, user give access to one client
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

        // Then, user want to authorize another client
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

        // User authorize another client
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
        }],

        /* Pass to `new_user` to `existing_user` 
           for the two authorize clients */

        getUser: ['getOauthClientAccessToken', function (cb, results) {
            getUser(results.getOauthClientAccessToken, cb);
        }],

        getUser2: ['getOauthClientAccessToken2', function (cb, results) {
            getUser(results.getOauthClientAccessToken2, cb);
        }],

        updatePhoneType: ['getUser', 'getUser2', function (cb, results) {
            var resp = results.getOauthClientAccessToken;

            var app = resp.app;
            var appAccessToken = resp && resp.appAccessToken;
            var userID = resp && resp.user.id;
            var phoneNumberID = resp && resp.user.phone_numbers[0].id;

            request(app)
                .put('/users/' + userID 
                     + '/phone-numbers/' 
                     + phoneNumberID)
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', 'Bearer ' + appAccessToken)
                .send(update)
                .expect('Content-Type', 'application/json; charset=utf-8')
                .expect('Cache-Control', 'no-store')
                .expect('Pragma', 'no-cache')
                .end(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
        }],

        getUser3: ['updatePhoneType', function (cb, results) {
            getUser(results.getOauthClientAccessToken, cb);
        }],

        getUser4: ['updatePhoneType', function (cb, results) {
            getUser(results.getOauthClientAccessToken2, cb);
        }]
    }, function (err, results) {
        var getUserResp = results.getUser3;
        var getUserResp2 = results.getUser4;

        if (err) {
            return cb(err);
        }

        cb(null, [getUserResp, getUserResp2]);
    });
};

var assertPhoneTypeEquals = function (expectedPhoneType,
                                      expectedUserStatus,
                                      expectedUpdatedFields) {
    
    return function (err, resp, cb) {
        var phoneNumbers = !err && resp.phone_numbers;
        var phoneNumber = !err && phoneNumbers[0];

        if (err) {
            return cb(err);
        }

        assert.strictEqual(resp.status, expectedUserStatus);

        if (expectedUserStatus === 'existing_user_after_update') {
            assert.deepEqual(resp.updated_fields, ['phone_numbers']);
        }

        assert.strictEqual(phoneNumbers.length, 1);

        assert.strictEqual(phoneNumber.phone_type, expectedPhoneType);

        if (expectedUserStatus === 'existing_user_after_update') {
            assert.deepEqual(phoneNumber.updated_fields,
                             expectedUpdatedFields);
        }

        cb();
    };
};

describe('GET /users/:user_id (User status) (After phone type update)', function () {
    before(function (done) {
        makeARequest = function (app, accessToken, userID, statusCode, done) {
            var cb = function (err, accessToken, userID) {
                if (err) {
                    return done(err);
                }

                request(app)
                    .get('/users/' + userID)
                    .set('Authorization', 'Bearer ' + accessToken)
                    .expect('Content-Type', 'application/json; charset=utf-8')
                    .expect('Cache-Control', 'no-store')
                    .expect('Pragma', 'no-cache')
                    .expect(statusCode, function (err, resp) {
                        if (err) {
                            return done(err);
                        }

                        assert.doesNotThrow(function () {
                            JSON.parse(resp.text);
                        });

                        done(null, resp.body);
                    });
            };

            cb(null, accessToken, userID);
        };

        done();
    });
    
    it('responds with HTTP code 200 when phone type was set to '
       + 'unknown for a mobile phone number asked by client', function (done) {

        var scopeFlags = ['mobile_phone_number'];
        var update = {
            number: '732-757-2923',
            country: 'US'
        };

        testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
            var executedFN = 0;

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assertPhoneTypeEquals('mobile', 'existing_user_after_update', ['number'])
                                     (err, user, function (err) {
                
                    if (err) {
                        return done(err);
                    }

                    // Test only once. 
                    // (Don't launch test for each users)
                    if (update.phone_type) {
                        return;
                    }

                    update.phone_type = 'unknown';

                    // Also test when phone 
                    // type was explicitly set
                    testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
                        if (err) {
                            return done(err);
                        }

                        users.forEach(function (user) {
                            assertPhoneTypeEquals('mobile', 'existing_user_after_update', ['number'])
                                                 (err, user, function (err) {

                                if (err) {
                                    return done(err);
                                }

                                executedFN++;

                                if (executedFN === users.length) {
                                    return done();
                                }
                            });
                        });
                    });
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

        testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
            var executedFN = 0;

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assertPhoneTypeEquals('landline', 'existing_user_after_update', ['number'])
                                     (err, user, function (err) {
                
                    if (err) {
                        return done(err);
                    }

                    // Test only once. 
                    // (Don't launch test for each users)
                    if (update.phone_type) {
                        return;
                    }

                    update.phone_type = 'unknown';

                    // Also test when phone 
                    // type was explicitly set
                    testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
                        if (err) {
                            return done(err);
                        }

                        users.forEach(function (user) {
                            assertPhoneTypeEquals('landline', 'existing_user_after_update', ['number'])
                                                 (err, user, function (err) {

                                if (err) {
                                    return done(err);
                                }

                                executedFN++;

                                if (executedFN === users.length) {
                                    return done();
                                }
                            });
                        });
                    });
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

        testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
            var executedFN = 0;

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assertPhoneTypeEquals('mobile', 'existing_user_after_update', ['number', 'phone_type'])
                                     (err, user, function (err) {
                
                    if (err) {
                        return done(err);
                    }

                    // Test only once. 
                    // (Don't launch test for each users)
                    if (update.phone_type) {
                        return;
                    }

                    update.phone_type = 'mobile';

                    // Also test when phone 
                    // type was explicitly set
                    testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
                        if (err) {
                            return done(err);
                        }

                        users.forEach(function (user) {
                            assertPhoneTypeEquals('mobile', 'existing_user_after_update', ['number', 'phone_type'])
                                                 (err, user, function (err) {

                                if (err) {
                                    return done(err);
                                }

                                executedFN++;

                                if (executedFN === users.length) {
                                    return done();
                                }
                            });
                        });
                    });
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

        testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
            var executedFN = 0;

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assertPhoneTypeEquals('landline', 'existing_user_after_update', ['number', 'phone_type'])
                                     (err, user, function (err) {
                
                    if (err) {
                        return done(err);
                    }

                    // Test only once. 
                    // (Don't launch test for each users)
                    if (update.phone_type) {
                        return;
                    }

                    update.phone_type = 'landline';

                    // Also test when phone 
                    // type was explicitly set
                    testForPhoneTypeUpdate(scopeFlags, update, function (err, users) {
                        if (err) {
                            return done(err);
                        }

                        users.forEach(function (user) {
                            assertPhoneTypeEquals('landline', 'existing_user_after_update', ['number', 'phone_type'])
                                                 (err, user, function (err) {

                                if (err) {
                                    return done(err);
                                }

                                executedFN++;

                                if (executedFN === users.length) {
                                    return done();
                                }
                            });
                        });
                    });
                });
            });
        });
    });
});