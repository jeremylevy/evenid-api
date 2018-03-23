var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var oauthAuthorizeBeforeHook = require('../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findUsers = require('../../../../testUtils/db/findUsers');
var findAddresses = require('../../../../testUtils/db/findAddresses');
var findUserAuthorizations = require('../../../../testUtils/db/findUserAuthorizations');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                          + '(?=.*full_name)(?=.*address_line_1)'
                          + '(?=.*address_line_2)(?=.*city)'
                          + '(?=.*state)(?=.*country)'
                          + '(?!.*"_id")(?!.*"__v")');

var validAddress = function () {
    return {
        full_name: 'John Malkovich',
        address_line_1: '747 east streat',
        address_line_2: 'builing 7',
        access_code: '67837',
        city: 'Pasadena',
        state: 'California',
        postal_code: '74874',
        country: 'US',
        address_type: 'residential'
    };
};

var assertAddressWasCreated = function (validAddress, user, accessToken, cb) {
    var assertAddressWasInserted = function (address, insertedAddress) {
        Object.keys(insertedAddress).forEach(function (key) {
            assert.strictEqual(address[key], insertedAddress[key]);
        });
    };

    async.auto({
        createUser: function (cb) {
            if (user && accessToken) {
                return cb(null, {
                    accessToken: accessToken,
                    user: user
                });
            }

            getAppAccessToken(function (err, accessToken, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, {
                    accessToken: accessToken,
                    user: user
                });
            });
        },

        createAddress: ['createUser', function (cb, results) {
            var createUserResp = results.createUser;
            var insertedAddress = validAddress();

            makeARequest.call({
                accessToken: createUserResp.accessToken,
                userID: createUserResp.user.id
            }, 200, insertedAddress, successReg, function (err, resp) {
                var address = resp && resp.body;

                if (err) {
                    return cb(err);
                }

                // Assert it returns created address
                assertAddressWasInserted(address, insertedAddress);

                cb(null, address);
            });
        }],

        assertAddressWasCreated: ['createAddress', function (cb, results) {
            var createdAddress = results.createAddress;
            var insertedAddress = validAddress();

            findAddresses([createdAddress.id], function (err, addresses) {
                var address = addresses[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(addresses.length, 1);

                assertAddressWasInserted(address, insertedAddress);

                cb();
            });
        }],

        assertUserWasUpdated: ['createAddress', function (cb, results) {
            var createUserResp = results.createUser;
            var createdAddress = results.createAddress;

            findUsers([createUserResp.user.id], function (err, users) {
                var user = users[0].toObject();

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(users.length, 1);

                // User may have multiple addresses 
                // when client was authorized
                assert.ok(user.addresses.length > 0);

                for (var i = 0, j = user.addresses.length; i < j; ++i) {
                    user.addresses[i] = user.addresses[i].toString();
                }

                assert.ok(user.addresses
                              .indexOf(createdAddress.id) !== -1);

                cb();
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null, results.createAddress);
    });
};
    
describe('POST /users/:user_id/addresses', function () {
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
                              + '/addresses')
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
    
    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: user.id
            }, 400, validAddress(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: user.id
            }, 400, validAddress(), /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

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
                }, 400, validAddress(), /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error '
       + 'when access token does not have authorization', function (done) {

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
                }, 400, validAddress(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to create user address', function (done) {

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
                }, 403, validAddress(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to create address for user which does not belong to him', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                userID: '507c7f79bcf86cd7994f6c0e'
            }, 403, validAddress(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user has reached  the maximum number of addresses allowed', function (done) {

        var oldLimit = config.EVENID_USERS.MAX_ENTITIES.ADDRESSES;
        var errorReg = new RegExp('access_denied'
                                  + '.*'
                                  + 'You have reached the maximum number of '
                                  + 'addresses allowed per user\\.');

        // Node.JS cache required modules, so config object is always the SAME
        config.EVENID_USERS.MAX_ENTITIES.ADDRESSES = 0;

        makeARequest(403, validAddress(), errorReg, function (err, resp) {
            config.EVENID_USERS.MAX_ENTITIES.ADDRESSES = oldLimit;

            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 400 and '
       + '`invalid_request` error when empty address', function (done) {

        var reg = new RegExp('(?=.*error)(?=.*full_name)'
                             + '(?=.*address_line_1)(?=.*country)'
                             + '(?=.*city)(?=.*postal_code)');

        makeARequest(400, {}, reg, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid address', function (done) {

        var reg = new RegExp('(?=.*error)(?=.*address_type)'
                             + '(?=.*full_name)(?=.*address_line_1)'
                             + '(?=.*address_line_2)(?=.*access_code)'
                             + '(?=.*city)(?=.*state)'
                             + '(?=.*postal_code)(?=.*country)'
                             // Added after a bug which returned 
                             // ``bar` is not a valid enum value 
                             // for path `address_type`.`
                             + '(?=.*Address type is not an allowed value.)');

        makeARequest(400, {
            address_type: 'bar',
            // '+2': for first and last elements 
            // given that we use the `join` method
            full_name: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.FULL_NAME + 2).join('a'),
            address_line_1: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_1 + 2).join('a'),
            address_line_2: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_2 + 2).join('a'),
            access_code: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ACCESS_CODE + 2).join('a'),
            city: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.CITY + 2).join('a'),
            state: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.STATE + 2).join('a'),
            postal_code: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.POSTAL_CODE + 2).join('a'),
            country: 'bar'
        }, reg, done);
    });
    
    it('responds with HTTP code 200 and address when '
       + 'valid address infos', function (done) {

        var user = null;
        var accessToken = null;

        assertAddressWasCreated(validAddress, user, accessToken, done);
    });

    it('responds with HTTP code 200 and authorize '
       + 'clients which have asked for addresses', function (done) {

        var defaultCallback = function (cb) {
            return function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            };
        };

        async.auto({
            /* We create two clients for same user */
            
            createFirstClient: function (cb) {
                oauthAuthorizeBeforeHook(defaultCallback(cb));
            },

            createSecondClient: ['createFirstClient', function (cb, results) {
                var createFirstClientResp = results.createFirstClient;

                oauthAuthorizeBeforeHook.call({
                    // We need to authorize multiple clients for SAME user
                    // so always use the same access token and user property
                    accessToken: createFirstClientResp.accessToken,
                    user: createFirstClientResp.user
                }, defaultCallback(cb));
            }],

            /* We authorize the two clients */

            authorizeFirstClient: ['createFirstClient', function (cb, results) {
                var createFirstClientResp = results.createFirstClient;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: createFirstClientResp,
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: ['separate_shipping_billing_address']
                }, defaultCallback(cb));
            }],

            authorizeSecondClient: ['authorizeFirstClient', 'createSecondClient', function (cb, results) {
                var createSecondClientResp = results.createSecondClient;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: createSecondClientResp,
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: ['separate_shipping_billing_address']
                }, defaultCallback(cb));
            }],

            /* We create the address  */
            
            assertAddressWasCreated: ['authorizeSecondClient', 
                                      function (cb, results) {

                var createFirstClientResp = results.createFirstClient;
                var authorizeClientResp = results.authorizeFirstClient;
                var authorizeClientResp2 = results.authorizeSecondClient;

                var user = createFirstClientResp.user;
                var accessToken = createFirstClientResp.accessToken;
                
                assertAddressWasCreated(validAddress, user,
                                        accessToken, function (err, results) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, results)
                });
            }],

            assertUserAuthorizationsWereUpdated: ['assertAddressWasCreated', 
                                                  function (cb, results) {
                
                var createFirstClientResp = results.createFirstClient;
                var user = createFirstClientResp.user;
                var createdAddress = results.assertAddressWasCreated;

                findUserAuthorizations([user.id], function (err, userAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    // We have authorized two clients
                    assert.strictEqual(userAuthorizations.length, 2);

                    userAuthorizations.forEach(function (userAuthorization) {
                        var addresses = [];

                        userAuthorization = userAuthorization.toObject();
                        addresses = userAuthorization.entities.addresses;

                        for (var i = 0, j = addresses.length; i < j; ++i) {
                            addresses[i] = addresses[i].toString();
                        }

                        assert.ok(addresses.indexOf(createdAddress.id) !== -1);
                    });

                    cb();
                });
            }],
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done(null, results);
        });
    });
});