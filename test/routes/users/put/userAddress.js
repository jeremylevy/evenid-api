var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createAddress = require('../../../../testUtils/users/createAddress');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findAddresses = require('../../../../testUtils/db/findAddresses');
var removeAddresses = require('../../../../testUtils/db/removeAddresses');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*\\{)(?=.*id)'
                          + '(?=.*full_name)(?=.*address_type)'
                          + '(?=.*address_line_1)(?=.*address_line_2)'
                          + '(?=.*city)(?=.*access_code)'
                          + '(?=.*postal_code)'
                          + '(?=.*state)(?=.*country)'
                          + '(?!.*"_id")(?!.*"__v")');
    
describe('PUT /users/:user_id/addresses/:address_id', function () {
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
                        .put('/users/' + userID 
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
       + 'non-app token try to update user address', function (done) {

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
                }, 403, {
                    address_line_1: '565 east streat'
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to modify user address which does not exist', function (done) {

        makeARequest.call({
            wrongAddressID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {
            address_line_1: '565 east streat'
        }, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to update user address which does not belong to him', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
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
                    addressID: addressID
                }, 403, {
                    address_line_1: '565 east streat'
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 404 and `not_found` error when '
       + 'attempt to modify owned user address which does not exist', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
            if (err) {
                return done(err);
            }

            removeAddresses([addressID], function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    addressID: addressID
                }, 404, {
                    address_line_1: '565 east streat'
                }, /not_found/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + ' error when  empty address infos', function (done) {

        var reg = new RegExp('(?=.*error)(?=.*address_type)'
                             + '(?=.*full_name)(?=.*address_line_1)'
                             + '(?=.*city)(?=.*postal_code)'
                             + '(?=.*country)');

        makeARequest(400, {
            address_type: '',
            full_name: '',
            address_line_1: '',
            city: '',
            postal_code: '',
            country: ''
            // Positive lookahead assertion
        }, reg, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when  invalid address infos', function (done) {

        var reg = new RegExp('(?=.*error)(?=.*address_type)'
                             + '(?=.*full_name)(?=.*address_line_1)'
                             + '(?=.*address_line_2)(?=.*access_code)'
                             + '(?=.*city)(?=.*state)'
                             + '(?=.*postal_code)(?=.*country)');

        makeARequest(400, {
            address_type: 'bar',
            // '+2': for first and last elements
            full_name: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.FULL_NAME + 2).join('a'),
            address_line_1: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_1 + 2).join('a'),
            address_line_2: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_2 + 2).join('a'),
            access_code: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ACCESS_CODE + 2).join('a'),
            city: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.CITY + 2).join('a'),
            state: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.STATE + 2).join('a'),
            postal_code: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.POSTAL_CODE + 2).join('a'),
            country: 'bar'
            // Positive lookahead assertion
        }, reg, done);
    });
    
    it('responds with HTTP code 200 and address when '
       + 'valid address infos', function (done) {

        var updatedAddress = {
            full_name: mongoose.Types.ObjectId().toString(),
            address_line_1: mongoose.Types.ObjectId().toString(),
            address_line_2: mongoose.Types.ObjectId().toString(),
            // Limited to 10 characters
            access_code: mongoose.Types.ObjectId().toString().slice(0, 10),
            city: mongoose.Types.ObjectId().toString(),
            state: mongoose.Types.ObjectId().toString(),
            postal_code: mongoose.Types.ObjectId().toString(),
            country: 'US',
            address_type: 'residential'
        };

        var assertAddressWasUpdated = function (address, updatedAddress) {
            Object.keys(updatedAddress).forEach(function (key) {
                assert.strictEqual(address[key], updatedAddress[key]);
            });
        };
        
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

            updateAddress: ['createAddress', function (cb, results) {
                var createAddressResp = results.createAddress;
                var accessToken = createAddressResp.accessToken;
                var userID = createAddressResp.userID;
                var addressID = createAddressResp.addressID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    addressID: addressID
                }, 200, updatedAddress, successReg, function (err, resp) {
                    var address = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns updated address
                    assertAddressWasUpdated(address, updatedAddress);

                    cb();
                });
            }],

            assertAddressWasUpdated: ['updateAddress', function (cb, results) {
                var createAddressResp = results.createAddress;
                var addressID = createAddressResp.addressID;

                findAddresses([addressID], function (err, addresses) {
                    var address = addresses[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(addresses.length, 1);

                    assertAddressWasUpdated(address, updatedAddress);

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