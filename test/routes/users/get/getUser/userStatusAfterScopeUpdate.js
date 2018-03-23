var request = require('supertest');
var assert = require('assert');

var async = require('async');

var config = require('../../../../../config');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;

var fromUnknownPhoneScopeData = function (resp, authorizeClientForUserResp) {
    return function () {
        // For second client
        if (authorizeClientForUserResp) {
            // Make sure we don't 
            // add the same phone number
            // twice
            return {
                phone_number: authorizeClientForUserResp.user
                                                        .phone_numbers[0]
                                                        .id
            };
        }

        return {
            phone_number_number: '+17327572923',
            phone_number_country: 'US'
        };
    };
};

var testFromScopeToScope = function (fromScope, fromScopeFlags, 
                                     toScope, toScopeFlags, cb) {

    var context = this;

    var authorizeClientForUser = function (oauthAuthBeforeHookResp, authorizeClientForUserResp) {
        return function (cb, results) {
            var oldValidFormDataFn = oauthAuthBeforeHookResp.validFormData;

            if (context.fromScopeData) {
                // `authorizeClientForUserResp` set for second client
                oauthAuthBeforeHookResp.validFormData = context.fromScopeData(oauthAuthBeforeHookResp,
                                                                              authorizeClientForUserResp);
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: oauthAuthBeforeHookResp,
                redirectionURIScope: fromScope,
                redirectionURIScopeFlags: fromScopeFlags
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Reset value
                oauthAuthBeforeHookResp.validFormData = oldValidFormDataFn;

                cb(null, resp);
            });
        };
    };

    var getUser = function (authorizeClientForUserResp) {
        return function (cb, results) {
            var app = authorizeClientForUserResp.app;
            var accessToken = authorizeClientForUserResp.accessToken;
            var userID = authorizeClientForUserResp.fakeUserID;
            
            makeARequest(app, accessToken, userID, 200, function (err, user) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(user.status, 'new_user');

                cb(null, user);
            });
        };
    };

    var updateScope = function (oauthAuthBeforeHookResp, authorizeClientForUserResp) {
        return function (cb, results) {
            var oldValidFormDataFn = oauthAuthBeforeHookResp.validFormData;

            if (context.toScopeData) {
                oauthAuthBeforeHookResp.validFormData = context.toScopeData(authorizeClientForUserResp);
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: oauthAuthBeforeHookResp,
                redirectionURIScope: toScope,
                redirectionURIScopeFlags: toScopeFlags,
                // We need to change flow to avoid redirect to login
                registeredUser: true
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Reset value
                oauthAuthBeforeHookResp.validFormData = oldValidFormDataFn;

                cb(null, resp)
            });
        };
    };

    var updateScopeAnotherTime = function (oauthAuthBeforeHookResp) {
        return function (cb, results) {
            if (!context.endScope) {
                return cb(null);
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: oauthAuthBeforeHookResp,
                redirectionURIScope: context.endScope,
                redirectionURIScopeFlags: context.endScopeFlags,
                // We need to change flow to avoid redirect to login
                registeredUser: true
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp)
            });
        };
    };

    async.auto({
        oauthAuthorizeBeforeHook: function (cb) {
            oauthAuthorizeBeforeHook(function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        },

        // We want to authorize 
        // another client for same user
        oauthAuthorizeBeforeHook2: ['oauthAuthorizeBeforeHook', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook

            oauthAuthorizeBeforeHook.call({
                user: resp.user,
                accessToken: resp.accessToken
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        }],

        // First, clients wants from scope
        authorizeClientForUser: ['oauthAuthorizeBeforeHook2', function (cb, results) {
            authorizeClientForUser(results.oauthAuthorizeBeforeHook)(cb, results);
        }],

        authorizeClient2ForUser: ['authorizeClientForUser', function (cb, results) {
            var authorizeClientForUserResp = results.authorizeClientForUser;

            authorizeClientForUser(results.oauthAuthorizeBeforeHook2, authorizeClientForUserResp)
                                  (cb, results);
        }],

        // We get the user to pass from `new_user` 
        // to `existing_user` for the two clients
        getUser: ['authorizeClient2ForUser', function (cb, results) {
            getUser(results.authorizeClientForUser)(cb, results);
        }],

        getUser2: ['getUser', function (cb, results) {
            getUser(results.authorizeClient2ForUser)(cb, results);
        }],

        // Now clients wants to scope
        updateScope: ['getUser2', function (cb, results) {
            updateScope(results.oauthAuthorizeBeforeHook,
                        results.authorizeClientForUser)
                       (cb, results);
        }],

        updateScope2: ['updateScope', function (cb, results) {
            updateScope(results.oauthAuthorizeBeforeHook2,
                        results.authorizeClient2ForUser)
                       (cb, results);
        }],

        // For tests with phone numbers 
        // (unknown, mobile/landline, unknown)
        updateScopeAnotherTime: ['updateScope2', function (cb, results) {
            updateScopeAnotherTime(results.oauthAuthorizeBeforeHook)(cb, results);
        }],

        updateScopeAnotherTime2: ['updateScopeAnotherTime', function (cb, results) {
            updateScopeAnotherTime(results.oauthAuthorizeBeforeHook2)(cb, results);
        }]
    }, function (err, results) {
        var updateScopeResp = results && (results.updateScopeAnotherTime 
                                          || results.updateScope);
        var updateScopeResp2 = results && (results.updateScopeAnotherTime2
                                          || results.updateScope2);

        var app = null;
        var app2 = null;

        var accessToken = null;
        var accessToken2 = null;

        var userID = null;
        var userID2 = null;

        if (err) {
            return cb(err);
        }

        app = updateScopeResp.app;
        app2 = updateScopeResp2.app;

        accessToken = updateScopeResp.accessToken;
        accessToken2 = updateScopeResp2.accessToken;

        userID = updateScopeResp.fakeUserID;
        userID2 = updateScopeResp2.fakeUserID;

        makeARequest(app, accessToken, userID, 200, function (err, user) {
            if (err) {
                return cb(err);
            }

            if (!context.toScopeData) {
                assert.strictEqual(user.status, 'existing_user_after_update');
            }

            makeARequest(app2, accessToken2, userID2, 200, function (err, user2) {
                if (err) {
                    return cb(err);
                }

                if (!context.toScopeData) {
                    assert.strictEqual(user2.status, 'existing_user_after_update');
                }

                cb(null, [user, user2]);
            });
        });
    });
};

var testUnknownThenLandMobThenUnknown = function (fromScopeData, cb) {
    testFromScopeToScope.call({
        fromScopeData: fromScopeData,
        endScope: ['phone_numbers'],
        endScopeFlags: []
    }, ['phone_numbers'], [], 
    ['phone_numbers'],
    ['landline_phone_number', 'mobile_phone_number'],
    function (err, users) {

        if (err) {
            return cb(err);
        }

        users.forEach(function (user) {
            assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

            assert.strictEqual(user.phone_numbers.length, 1);
        });

        cb(null, users);
    });
};

describe('GET /users/:user_id (User status) (After scope update)', function () {
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
    
    it('responds with `existing_user_after_update` '
       + 'from `first_name` to full scope', function (done) {

        testFromScopeToScope(['first_name'], [], 
                             config.EVENID_OAUTH.VALID_USER_SCOPE,
                             config.EVENID_OAUTH.VALID_USER_SCOPE_FLAGS,
                             function (err, users) {

            // Remove first name authorized first
            var updatedFields = config.EVENID_OAUTH.VALID_USER_SCOPE.filter(function (v) {
                return v !== 'first_name';
            });

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assert.ok(compareArray(user.updated_fields, updatedFields));

                Object.keys(config.EVENID_OAUTH.VALID_ENTITY_FIELDS)
                      .forEach(function (entityName) {
                    
                    var entityNB = 2;

                    if (entityName === 'USERS') {
                        return;
                    }

                    if (entityName === 'EMAILS') {
                        entityNB = 1;
                    }

                    // Two clients which 
                    // authorize two addresses
                    if (entityName === 'ADDRESSES') {
                        entityNB = 4;
                    }

                    assert.strictEqual(user[entityName.toLowerCase()].length, entityNB);

                    user[entityName.toLowerCase()].forEach(function (entity) {
                        assert.strictEqual(entity.status, 'new');

                        assert.ok(compareArray(entity.updated_fields, []));
                    });
                });
            });

            done();
        });
    });
    
    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to mobile phone number', function (done) {

        testFromScopeToScope.call({
            fromScopeData: fromUnknownPhoneScopeData
        }, ['phone_numbers'], [], 
        ['phone_numbers'], 
        ['mobile_phone_number'],
        function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

                assert.strictEqual(user.phone_numbers.length, 1);

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'new');
                assert.ok(compareArray(newPhoneNumber.updated_fields, []));
                assert.strictEqual(newPhoneNumber.phone_type, 'mobile');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to landline phone number', function (done) {

        testFromScopeToScope.call({
            fromScopeData: fromUnknownPhoneScopeData
        }, ['phone_numbers'], [], 
        ['phone_numbers'], 
        ['landline_phone_number'],
        function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

                assert.strictEqual(user.phone_numbers.length, 1);

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'new');
                assert.ok(compareArray(newPhoneNumber.updated_fields, []));
                assert.strictEqual(newPhoneNumber.phone_type, 'landline');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to mobile phone '
       + 'number with same number', function (done) {

        var toScopeData = function (resp) {
            var user = resp.user;

            return function () {
                return {
                    mobile_phone_number: user.phone_numbers[0].id,
                };
            };
        };

        testFromScopeToScope.call({
            fromScopeData: fromUnknownPhoneScopeData,
            toScopeData: toScopeData
        }, ['phone_numbers'], [], 
        ['phone_numbers'],
        ['mobile_phone_number'],
        function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

                assert.strictEqual(user.phone_numbers.length, 1);

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'updated');
                
                assert.ok(compareArray(newPhoneNumber.updated_fields, ['phone_type']));
                
                assert.strictEqual(newPhoneNumber.phone_type, 'mobile');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to landline phone '
       + 'number with same number', function (done) {

        var toScopeData = function (resp) {
            var user = resp.user;

            return function () {
                return {
                    landline_phone_number: user.phone_numbers[0].id,
                };
            };
        };

        testFromScopeToScope.call({
            fromScopeData: fromUnknownPhoneScopeData,
            toScopeData: toScopeData
        }, ['phone_numbers'], [], 
        ['phone_numbers'],
        ['landline_phone_number'],
        function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

                assert.strictEqual(user.phone_numbers.length, 1);

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'updated');
                assert.ok(compareArray(newPhoneNumber.updated_fields, ['phone_type']));
                assert.strictEqual(newPhoneNumber.phone_type, 'landline');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to landline and '
       + 'mobile phone number', function (done) {

        testFromScopeToScope(['phone_numbers'], [], 
                             ['phone_numbers'],
                             ['landline_phone_number', 'mobile_phone_number'],
                             function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;
                var returnedPhoneTypes = [];

                assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

                assert.strictEqual(user.phone_numbers.length, 2);

                user.phone_numbers.forEach(function (newPhoneNumber) {
                    assert.strictEqual(newPhoneNumber.status, 'new');
                    assert.ok(compareArray(newPhoneNumber.updated_fields, []));
                    
                    returnedPhoneTypes.push(newPhoneNumber.phone_type);
                });

                assert.ok(compareArray(returnedPhoneTypes, ['landline', 'mobile']));
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` and unknown phone number '
       + 'from unknown phone number to landline and '
       + 'mobile phone number to unknown phone number', function (done) {

        testUnknownThenLandMobThenUnknown(null, function (err, users) {
            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'old');
                assert.ok(compareArray(newPhoneNumber.updated_fields, []));
                assert.strictEqual(newPhoneNumber.phone_type, 'unknown');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` and mobile phone number '
       + 'from unknown phone number to landline and '
       + 'mobile phone number to unknown phone number '
       + 'when passing mobile phone number first', function (done) {

        var fromScopeData = function (resp) {
            return function () {
                return {
                    phone_number_number: '+33638475647',
                    phone_number_country: 'FR'
                };
            };
        };

        testUnknownThenLandMobThenUnknown(fromScopeData, function (err, users) {
            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'old');
                assert.ok(compareArray(newPhoneNumber.updated_fields, []));
                assert.strictEqual(newPhoneNumber.phone_type, 'mobile');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to landline '
       + 'phone number to unknown phone number '
       + 'when passing landline phone number first', function (done) {

        var fromScopeData = function (resp) {
            return function () {
                return {
                    phone_number_number: '+33491475647',
                    phone_number_country: 'FR'
                };
            };
        };
        var toScopeData = fromScopeData;

        testFromScopeToScope.call({
            fromScopeData: fromScopeData,
            toScopeData: toScopeData,
            endScope: ['phone_numbers'],
            endScopeFlags: []
        }, ['phone_numbers'], [], 
        ['phone_numbers'],
        ['landline_phone_number'],
        function (err, users) {
            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var newPhoneNumber = null;

                assert.ok(compareArray(user.updated_fields, []));

                assert.strictEqual(user.phone_numbers.length, 1);

                newPhoneNumber = user.phone_numbers[0];

                assert.strictEqual(newPhoneNumber.status, 'old');
                assert.ok(compareArray(newPhoneNumber.updated_fields, []));

                assert.strictEqual(newPhoneNumber.phone_type, 'landline');
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown address to shipping billing address '
       + 'with billing and shipping address set to same address', function (done) {

        var toScopeData = function (resp) {
            var data = resp.validFormData();

            data.use_as_billing_address = 'true';

            return function () {
                return data;
            };
        };

        testFromScopeToScope.call({
            toScopeData: toScopeData
        }, ['addresses'], [], 
        ['addresses'],
        ['separate_shipping_billing_address'],
        function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var oldAddresses = [];
                var newAddresses = [];

                assert.ok(compareArray(user.updated_fields, ['addresses']));

                // Two clients which 
                // authorize two addresses
                // (One as unknown and one as shipping)
                assert.strictEqual(user.addresses.length, 4);

                user.addresses.forEach(function (address) {
                    if (address.status === 'updated') {
                        oldAddresses.push(address);
                    } else {
                        newAddresses.push(address);
                    }
                });

                assert.strictEqual(oldAddresses.length, 2);
                assert.strictEqual(newAddresses.length, 2);

                oldAddresses.forEach(function (oldAddress) {
                    assert.strictEqual(oldAddress.status, 'updated');
                    assert.ok(compareArray(oldAddress.updated_fields, ['first_for']));
                });

                newAddresses.forEach(function (newAddress) {
                    assert.strictEqual(newAddress.status, 'new');
                    assert.ok(compareArray(newAddress.updated_fields, []));

                    assert.ok(compareArray(newAddress.first_for, ['shipping', 'billing']) 
                           || compareArray(newAddress.first_for, []));
                });
            });

            done();
        });
    });
    
    it('responds with `existing_user_after_update` '
       + 'from unknown address to shipping billing address', function (done) {

        testFromScopeToScope(['addresses'], [], 
                             ['addresses'],
                             ['separate_shipping_billing_address'],
                             function (err, users) {

            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                var oldAddresses = [];
                var newAddresses = [];

                assert.ok(compareArray(user.updated_fields, ['addresses']));

                // Three addresses per client
                // (One as unknown, two for billing / shipping)
                assert.strictEqual(user.addresses.length, 6);

                user.addresses.forEach(function (address) {
                    if (address.status === 'updated') {
                        oldAddresses.push(address);
                    } else {
                        newAddresses.push(address);
                    }
                });

                // Unknown addresses are old
                assert.strictEqual(oldAddresses.length, 2);
                assert.strictEqual(newAddresses.length, 4);

                oldAddresses.forEach(function (oldAddress) {
                    assert.strictEqual(oldAddress.status, 'updated');
                    assert.ok(compareArray(oldAddress.updated_fields, ['first_for']));
                });

                newAddresses.forEach(function (address) {
                    assert.strictEqual(address.status, 'new');
                    assert.ok(compareArray(address.updated_fields, []));
                });
            });

            done();
        });
    });

    it('responds with `existing_user_after_update` from '
       + 'unknown address to shipping billing address '
       + 'when user reuse same address', function (done) {

        var toScopeData = function (resp) {
            var user = resp.user;

            return function () {
                return {
                    shipping_address: user.addresses[0].id,
                    billing_address: user.addresses[0].id
                };
            };
        };

        testFromScopeToScope.call({
            toScopeData: toScopeData
        }, ['addresses'], [], 
        ['addresses'], ['separate_shipping_billing_address'],
        function (err, users) {
            
            if (err) {
                return done(err);
            }

            users.forEach(function (user) {
                assert.strictEqual(user.status, 'existing_user_after_update');
                assert.ok(compareArray(user.updated_fields, ['addresses']));

                // One unknown address per client
                assert.strictEqual(user.addresses.length, 2);

                user.addresses.forEach(function (address) {
                    assert.strictEqual(address.status, 'updated');
                    assert.ok(compareArray(address.updated_fields, ['first_for']));
                });
            });

            done();
        });
    });
    
    it('responds with `existing_user_after_update` when client ask for '
       + 'shipping billing address on each login '
       + 'and user reuse same address', function (done) {

        var toScopeData = function (resp) {
            var user = resp.user;

            return function () {
                return {
                    shipping_address: user.addresses[0].id,
                    billing_address: user.addresses[0].id
                };
            };
        };

        testFromScopeToScope.call({
            toScopeData: toScopeData
        }, ['addresses'], ['separate_shipping_billing_address'], 
        ['addresses'], ['separate_shipping_billing_address'],
        function (err, users) {
            
            if (err) {
                return done(err);
            }
            
            users.forEach(function (user) {
                assert.strictEqual(user.status, 'existing_user_after_update');
                assert.ok(compareArray(user.updated_fields, ['addresses']));

                // Two addresses per client
                // (One as billingn and one as shipping)
                assert.strictEqual(user.addresses.length, 4);

                user.addresses.forEach(function (address) {
                    assert.strictEqual(address.status, 'updated');
                    assert.ok(compareArray(address.updated_fields, ['first_for']));
                });
            });

            done();
        });
    });
});