var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var createAddress = require('../../../../testUtils/users/createAddress');
var findAddresses = require('../../../../testUtils/db/findAddresses');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

describe('DELETE /users/:user_id/addresses/:address_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, userID, addressID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .delete('/users/' + (this.wrongUserID || userID) 
                                + '/addresses/' 
                                + (this.wrongAddressID || addressID))
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
                    return cb(null, this.accessToken, this.userID, this.addressID);
                }

                createAddress(cb);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);
            createAddress = createAddress(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: userID,
                addressID: addressID
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                addressID: addressID
            }, 400, {}, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
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
                    addressID: addressID
                }, 400, {}, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
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
                    addressID: addressID
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to delete address', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
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
                    addressID: addressID
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete address for invalid user', function (done) {

        makeARequest.call({
            wrongUserID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to delete address which does not belong to him', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
            if (err) {
                return done(err);
            }

            getAppAccessToken.call({
                isDev: true
            }, function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    addressID: addressID
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete invalid address', function (done) {

        makeARequest.call({
            wrongAddressID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete address used by clients', function (done) {

        getOauthClientAccessToken.call({
            redirectionURIScope: ['addresses'],
            redirectionURIScopeFlags: []
        }, function (err, resp) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: resp.appAccessToken,
                userID: resp.user.id,
                addressID: resp.user.addresses[0].id
            }, 403, {}, /access_denied/, done);
        });
    });

    it('responds with HTTP code 200 when '
       + 'deleting valid address', function (done) {

        async.auto({
            createAddress: function (cb) {
                createAddress(function (err, accessToken, userID, addressID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        addressID: addressID
                    });
                });
            },

            assertAddressWasCreated: ['createAddress', function (cb, results) {
                var createAddressResp = results.createAddress;
                var addressID = createAddressResp.addressID;
                
                findAddresses([addressID], function (err, addresses) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(addresses.length, 1);

                    cb();
                });
            }],

            deleteAddress: ['assertAddressWasCreated', function (cb, results) {
                var createAddressResp = results.createAddress;
                var userID = createAddressResp.userID;
                var accessToken = createAddressResp.accessToken;
                var addressID = createAddressResp.addressID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    addressID: addressID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertAddressWasDeleted: ['deleteAddress', function (cb, results) {
                var createAddressResp = results.createAddress;
                var addressID = createAddressResp.addressID;

                findAddresses([addressID], function (err, addresses) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(addresses.length, 0);

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