var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getOauthClientAccessToken = require('../../getOauthClientAccessToken');

var CreateAddress = require('../../users/createAddress');

var compareArray = require('../../lib/compareArray');
var assertUserContainsClientSpecificIDs = require('../../lib/assertUserContainsClientSpecificIDs');

module.exports = function (useTestAccount) {
    var desc = 'GET /users/:user_id (Client specific IDs) (Addresses)';

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
        
        if (!useTestAccount) {
            it('returns client specific user ID and '
               + 'entities ID when user has '
               + 'authorized access to another address for client', function (done) {

                async.auto({
                    getOauthClientAccessToken: function (cb) {
                        getOauthClientAccessToken(function (err, resp) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, resp);
                        });
                    },

                    createAddress: ['getOauthClientAccessToken', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        // We mock `getAccessToken` function
                        var createAddress = CreateAddress(resp.app, function (cb) {
                            cb(null, resp.appAccessToken, resp.user);
                        });

                        createAddress(function (err, accessToken, userID, 
                                                addressID, addressLine1) {
                            
                            if (err) {
                                return cb(err);
                            }

                            cb(null);
                        });
                    }],

                    assertClientSpecificIDs: ['createAddress', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        makeARequest.call({
                            accessToken: resp.accessToken,
                            userID: resp.fakeUserID
                        }, 200, function (err, user) {
                            if (err) {
                                return cb(err);
                            }

                            // Make sure address was created
                            assert.strictEqual(user.addresses.length, 3);

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
        }
        
        it('returns client specific user ID and '
           + 'entities ID when client ask for billing/shipping '
           + 'adddress after it has asked for address', function (done) {

            async.auto({
                // First client ask for address
                getOauthClientAccessToken: function (cb) {
                    getOauthClientAccessToken.call({
                        redirectionURIScope: ['addresses'],
                        redirectionURIScopeFlags: [],
                        useTestAccount: !!useTestAccount
                    }, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp);
                    });
                },

                // Now, client ask for 
                // shipping/billing address
                getOauthClientAccessToken2: ['getOauthClientAccessToken', function (cb, results) {
                    var resp = results.getOauthClientAccessToken;

                    getOauthClientAccessToken.call({
                        oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                        redirectionURIScope: ['addresses'],
                        redirectionURIScopeFlags: ['separate_shipping_billing_address'],
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
                // authorized access three addresses
                assertClientSpecificIDs: ['getOauthClientAccessToken2', function (cb, results) {
                    var resp = results.getOauthClientAccessToken2;

                    makeARequest.call({
                        accessToken: resp.accessToken,
                        userID: resp.fakeUserID
                    }, 200, function (err, user) {
                        if (err) {
                            return cb(err);
                        }
                        
                        // Make sure the THREE addresses were returned
                        assert.strictEqual(user.addresses.length, useTestAccount ? 1 : 3);

                        if (useTestAccount) {
                            assert.deepEqual(user.addresses[0].first_for, []);
                        }

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
           + 'when client ask for shipping and billing address '
           + 'after it has asked for unknown address '
           + 'and user send same address for unknown and shipping '
           + 'or billing', function (done) {

            var testFor = function (addressType, cb) {
                var clientAddressID = null;

                async.auto({
                    // First client ask for any address
                    getOauthClientAccessToken: function (cb) {
                        getOauthClientAccessToken.call({
                            redirectionURIScope: ['addresses'],
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

                            clientAddressID = user.addresses[0].id;

                            if (useTestAccount) {
                                assert.deepEqual(user.addresses[0].first_for, []);
                            }

                            cb(null, user);
                        });
                    }],

                    // Now, client ask for 
                    // shipping and billing addresses
                    getOauthClientAccessToken2: ['getAddressID', function (cb, results) {
                        var resp = results.getOauthClientAccessToken;

                        getOauthClientAccessToken.call({
                            oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                            redirectionURIScope: ['addresses'],
                            redirectionURIScopeFlags: ['separate_shipping_billing_address'],
                            registeredUser: true,
                            useTestAccount: !!useTestAccount,
                            validFormData: function () {
                                var data = {};
                                var otherAddressType = addressType === 'shipping' ? 'billing' : 'shipping';

                                if (useTestAccount) {
                                    return {};
                                }

                                if (addressType === 'unknown') {
                                    data.shipping_address = resp.user.addresses[0].id;
                                    data.billing_address = resp.user.addresses[0].id;

                                    return data;
                                }

                                data[addressType + '_address'] = resp.user.addresses[0].id;

                                data[otherAddressType + '_address_full_name'] = 'bar bar';
                                data[otherAddressType + '_address_address_line_1'] = 'bar';
                                data[otherAddressType + '_address_address_type'] = 'residential';
                                data[otherAddressType + '_address_postal_code'] = '13013';
                                data[otherAddressType + '_address_city'] = 'Marseille';
                                data[otherAddressType + '_address_country'] = 'FR';
                                data[otherAddressType + '_phone_number_country'] = 'FR';

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
                    // authorized access to TWO addresses
                    assertClientSpecificIDs: ['getOauthClientAccessToken2', function (cb, results) {
                        var resp = results.getOauthClientAccessToken2;

                        makeARequest.call({
                            accessToken: resp.accessToken,
                            userID: resp.fakeUserID
                        }, 200, function (err, user) {
                            if (err) {
                                return cb(err);
                            }

                            // Make sure one or two addresses were returned
                            // depending on address type and the use of test account
                            assert.strictEqual(user.addresses.length,
                                               useTestAccount || addressType === 'unknown' ? 1 : 2);

                            // Make sure it reuse the same ID for unknown address
                            assert.strictEqual(user.addresses.filter(function (v) {
                                return v.id === clientAddressID;
                            }).length, 1);

                            if (useTestAccount) {
                                assert.deepEqual(user.addresses[0].first_for, []);
                            }

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

            testFor('unknown', function (err) {
                if (err) {
                    return done(err);
                }

                testFor('shipping', function (err) {
                    if (err) {
                        return done(err);
                    }

                    testFor('billing', done);
                });
            });
        });
    });
};