var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getOauthClientAccessToken = require('../../getOauthClientAccessToken');

var CreateAddress = require('../../users/createAddress');

var assertUserContainsClientSpecificIDs = require('../../lib/assertUserContainsClientSpecificIDs');

module.exports = function (useTestAccount) {
    var desc = 'GET /users/:user_id (Client specific IDs) (Phone numbers)';

    if (useTestAccount) {
        desc += ' (Use test acccount)';
    }

    describe(desc, function () {
        var makeARequest = null;
        var app = null;

        before(function (done) {
            require('../../../index')(function (err, _app) {
                if (err) {
                    return done(err);
                }

                app = _app;
                
                makeARequest = function (statusCode, done) {
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

                    if (this.accessToken) {
                        return cb(null, this.accessToken, this.userID);
                    }

                    cb(null, accessToken, userID);
                };

                done();
            });
        });
        
        it('returns client specific user ID and entities ID '
           + 'when client ask for mobile and landline phone '
           + 'number after it has asked for unknown phone number ', function (done) {

            var clientUnknownPhoneNumberID = null;

            async.auto({
                // First client ask for unknown phone number
                getOauthClientAccessToken: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIScope: ['phone_numbers'],
                        redirectionURIScopeFlags: [],
                        useTestAccount: !!useTestAccount
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                getAddressID: ['getOauthClientAccessToken', function (cb, results) {
                    var resp = results.getOauthClientAccessToken;

                    makeARequest.call({
                        accessToken: resp.accessToken,
                        userID: resp.fakeUserID
                    }, 200, function (err, user) {
                        if (err) {
                            return cb(err);
                        }

                        clientUnknownPhoneNumberID = user.phone_numbers[0].id;

                        cb(null, user);
                    });
                }],

                // Now, client ask for 
                // mobile and landline phone number
                getOauthClientAccessToken2: ['getAddressID', function (cb, results) {
                    var resp = results.getOauthClientAccessToken;

                    getOauthClientAccessToken.call({
                        oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                        redirectionURIScope: ['phone_numbers'],
                        redirectionURIScopeFlags: ['mobile_phone_number', 'landline_phone_number'],
                        registeredUser: true,
                        useTestAccount: !!useTestAccount
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                }],

                // At this point user has 
                // authorized access to THREE numbers
                assertClientSpecificIDs: ['getOauthClientAccessToken2', function (cb, results) {
                    var resp = results.getOauthClientAccessToken2;

                    makeARequest.call({
                        accessToken: resp.accessToken,
                        userID: resp.fakeUserID
                    }, 200, function (err, user) {
                        if (err) {
                            return cb(err);
                        }
                        
                        // Make sure TWO phone numbers were returned
                        assert.strictEqual(user.phone_numbers.length, 2);

                        // Make sure it's mobile and landline phone number
                        // If test account was used, mobile phone number is used
                        // as unknown
                        assert.strictEqual(user.phone_numbers.filter(function (v) {
                            return v.id === clientUnknownPhoneNumberID;
                        }).length, useTestAccount ? 1 : 0);

                        assertUserContainsClientSpecificIDs(resp.client.id, 
                                                            resp.user.id, 
                                                            user, cb);
                    });
                }]
            }, function (err, results) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });

        it('returns client specific user ID and entities ID '
           + 'when client ask for mobile and landline phone '
           + 'number after it has asked for unknown phone number '
           + 'and user send same number for unknown and landline or mobile', function (done) {

            var testFor = function (phoneType, cb) {
                var clientUnknownPhoneNumberID = null;

                async.auto({
                    // First client ask for unknown phone number
                    getOauthClientAccessToken: function (cb) {
                        getOauthClientAccessToken.call({
                            redirectionURIScope: ['phone_numbers'],
                            redirectionURIScopeFlags: [],
                            useTestAccount: !!useTestAccount
                        }, function (err, resp) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, resp);
                        });
                    },

                    getAddressID: ['getOauthClientAccessToken', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        makeARequest.call({
                            accessToken: resp.accessToken,
                            userID: resp.fakeUserID
                        }, 200, function (err, user) {
                            if (err) {
                                return cb(err);
                            }

                            clientUnknownPhoneNumberID = user.phone_numbers[0].id;

                            cb(null, user);
                        });
                    }],

                    // Now, client ask for 
                    // mobile and landline phone number
                    getOauthClientAccessToken2: ['getAddressID', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        getOauthClientAccessToken.call({
                            oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                            redirectionURIScope: ['phone_numbers'],
                            redirectionURIScopeFlags: ['mobile_phone_number', 'landline_phone_number'],
                            registeredUser: true,
                            useTestAccount: !!useTestAccount,
                            validFormData: function () {
                                var data = {};
                                var otherPhoneType = phoneType === 'mobile' ? 'landline' : 'mobile';

                                if (useTestAccount) {
                                    return {};
                                }

                                data[phoneType + '_phone_number'] = resp.user.phone_numbers[0].id;

                                data[otherPhoneType + '_phone_number_number'] = otherPhoneType === 'mobile' 
                                    ? '+33639485948' 
                                    : '+33491384748';

                                data[otherPhoneType + '_phone_number_country'] = 'FR';

                                return data;
                            }
                        }, function (err, resp) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, resp);
                        });
                    }],

                    // At this point user has 
                    // authorized access to TWO numbers
                    assertClientSpecificIDs: ['getOauthClientAccessToken2', function (cb, results) {
                        var resp = results.getOauthClientAccessToken2;

                        makeARequest.call({
                            accessToken: resp.accessToken,
                            userID: resp.fakeUserID
                        }, 200, function (err, user) {
                            if (err) {
                                return cb(err);
                            }

                            // Make sure TWO phone number was returned
                            assert.strictEqual(user.phone_numbers.length, 2);

                            // Make sure it reuse the same ID for unknown
                            // Test account use same ID for mobile and unknown
                            assert.strictEqual(user.phone_numbers.filter(function (v) {
                                return v.id === clientUnknownPhoneNumberID;
                            }).length, 1);

                            assertUserContainsClientSpecificIDs(resp.client.id, 
                                                                resp.user.id, 
                                                                user, cb);
                        });
                    }],

                    /* Assert we can revert to 
                       unknown phone number without changing ID */

                    getOauthClientAccessToken3: ['assertClientSpecificIDs', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        getOauthClientAccessToken.call({
                            oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                            redirectionURIScope: ['phone_numbers'],
                            redirectionURIScopeFlags: [],
                            registeredUser: true,
                            useTestAccount: !!useTestAccount,
                            validFormData: function () {
                                return {};
                            }
                        }, function (err, resp) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, resp);
                        });
                    }],

                    assertUnknownPhoneIDRemainUnchanged: ['getOauthClientAccessToken3', function (cb, results) {
                        var resp = results.getOauthClientAccessToken3;

                        makeARequest.call({
                            accessToken: resp.accessToken,
                            userID: resp.fakeUserID
                        }, 200, function (err, user) {
                            if (err) {
                                return cb(err);
                            }

                            // Make sure unknown only phone number was returned
                            assert.strictEqual(user.phone_numbers.length, 1);

                            // Make sure it reuse the same ID for unknown
                            assert.strictEqual(user.phone_numbers[0].id, clientUnknownPhoneNumberID);

                            assertUserContainsClientSpecificIDs(resp.client.id, 
                                                                resp.user.id, 
                                                                user, cb);
                        });
                    }]
                }, function (err, results) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            };

            testFor('mobile', function (err) {
                if (err) {
                    return done(err);
                }

                testFor('landline', done);
            });
        });
        
        it('returns client specific user ID and '
           + 'entities ID when client ask for specificaly '
           + 'mobile or landline phone number after it has '
           + 'asked for unknown phone number and user has send '
           + 'a mobile or landline phone number the first time ', function (done) {

            var testFor = function (phoneNumberType, cb) {
                async.auto({
                    // First client ask for any phone number
                    // and user send phone number with specific type
                    getOauthClientAccessToken: function (cb) {
                        getOauthClientAccessToken.call({
                            redirectionURIScope: ['phone_numbers'],
                            redirectionURIScopeFlags: [],
                            useTestAccount: !!useTestAccount,
                            validFormData: function () {
                                if (useTestAccount) {
                                    return {};
                                }
                                
                                return {
                                    phone_number_number: phoneNumberType === 'mobile' 
                                        ? '+33618495847' 
                                        : '+33491273646',
                                    phone_number_country: 'FR'
                                };
                            }
                        }, function (err, resp) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, resp);
                        });
                    },

                    // Now, client ask for 
                    // phone number with specific type
                    getOauthClientAccessToken2: ['getOauthClientAccessToken', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        getOauthClientAccessToken.call({
                            oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                            redirectionURIScope: ['phone_numbers'],
                            redirectionURIScopeFlags: [phoneNumberType + '_phone_number'],
                            useTestAccount: !!useTestAccount,
                            validFormData: function () {
                                return {};
                            },
                            registeredUser: true
                        }, function (err, resp) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, resp);
                        });
                    }],

                    assertClientSpecificIDs: ['getOauthClientAccessToken2', function (cb, results) {
                        var resp = results.getOauthClientAccessToken2;

                        makeARequest.call({
                            accessToken: resp.accessToken,
                            userID: resp.fakeUserID
                        }, 200, function (err, user) {
                            if (err) {
                                return cb(err);
                            }
                            
                            // Make sure phone number was created
                            assert.strictEqual(user.phone_numbers.length, 1);

                            assertUserContainsClientSpecificIDs(resp.client.id, 
                                                                resp.user.id, 
                                                                user, cb);
                        });
                    }]
                }, function (err, results) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            };

            testFor('mobile', function (err) {
                if (err) {
                    return done(err);
                }

                testFor('landline', done);
            });
        });
        
        // Test for bug which try to get client 
        // specific unknown phone number ID with entity ID
        // set to a mobile or landline phone number when
        // iterating on `userAuthorization.entities.phone_numbers`
        // in `getUser` middleware.
        it('returns client specific user ID and '
           + 'entities ID when client ask for unknown '
           + 'phone number after it has asked for specifically '
           + 'mobile and landline phone number', function (done) {

            async.auto({
                // First client ask for specifically
                // mobile and landline phone number
                getOauthClientAccessToken: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIScope: ['phone_numbers'],
                        redirectionURIScopeFlags: ['mobile_phone_number', 'landline_phone_number'],
                        useTestAccount: !!useTestAccount
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                // Now, client ask for 
                // unknown phone number
                getOauthClientAccessToken2: ['getOauthClientAccessToken', function (cb, results) {
                    var resp = results.getOauthClientAccessToken;

                    getOauthClientAccessToken.call({
                        oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                        redirectionURIScope: ['phone_numbers'],
                        redirectionURIScopeFlags: [],
                        useTestAccount: !!useTestAccount,
                        validFormData: function () {
                            return {};
                        },
                        registeredUser: true
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                }],

                // At this point user has 
                // authorized access to TWO numbers
                assertClientSpecificIDs: ['getOauthClientAccessToken2', function (cb, results) {
                    var resp = results.getOauthClientAccessToken2;

                    makeARequest.call({
                        accessToken: resp.accessToken,
                        userID: resp.fakeUserID
                    }, 200, function (err, user) {
                        if (err) {
                            return cb(err);
                        }
                        
                        // Make sure ONLY ONE phone number was returned
                        assert.strictEqual(user.phone_numbers.length, 1);

                        assertUserContainsClientSpecificIDs(resp.client.id, 
                                                            resp.user.id, 
                                                            user, cb);
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
};