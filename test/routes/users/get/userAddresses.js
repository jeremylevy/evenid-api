var assert = require('assert');
var request = require('supertest');

var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var localesData = require('../../../../locales/data');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createAddress = require('../../../../testUtils/users/createAddress');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var USTerritories = localesData['en-us'].territories;

var makeARequest = null;
var app = null;
    
describe('GET /users/:user_id/addresses', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, userID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/users/' + userID + '/addresses')
                        .set('Authorization', authHeader)
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
                userID: userID
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createAddress(function (err, accessToken, userID, addressID) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID
            }, 400, /invalid_token/, done);
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
                    userID: userID
                }, 400, /expired_token/, done);
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
                    userID: userID
                }, 400, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to get user addresses', function (done) {
        
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
                    userID: userID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to get addresses which does not belong to him', function (done) {
        
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
                    userID: userID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 200 and addresses when '
       + 'getting valid user addresses', function (done) {

        // Positive lookahead assertion - Negative lookahead assertion
        var reg = new RegExp('(?=.*\\{)(?=.*id)' 
                           + '(?=.*full_name)(?=.*address_line_1)' 
                           + '(?=.*address_line_2)(?=.*city)'
                           + '(?=.*postal_code)(?=.*address_type)'
                           + '(?=.*access_code)'
                           + '(?=.*state)(?=.*country)'
                             // Resp sent as
                             // {address: ..., territories: ...}
                           + '(?=.*addresses)(?=.*territories)'
                           + '(?!.*"_id")(?!.*"__v")');

        makeARequest(200, reg, function (err, resp) {
            var body = !err && resp.body || {};
            var addresses = body.addresses;
            var territories = body.territories;

            if (err) {
                return done(err);
            }

            // {addresses: {...}, territories: {...}}
            assert.strictEqual(Object.keys(body).length, 2);

            addresses.forEach(function (address) {
                assert.strictEqual(Object.keys(address).length, 10);
            
                assert.ok(areValidObjectIDs([address.id]));

                assert.ok(Type.is(address.full_name, String) 
                          && address.full_name.length > 0);

                assert.ok(Type.is(address.address_line_1, String) 
                          && address.address_line_1.length > 0);

                assert.ok(Type.is(address.city, String) 
                          && address.city.length > 0);

                assert.ok(Type.is(address.postal_code, String) 
                          && address.postal_code.length > 0);

                assert.ok(Type.is(address.country, String) 
                          && address.country.length > 0);

                assert.ok(Type.is(address.address_type, String) 
                          && ['residential', 
                              'commercial'].indexOf(address.address_type) !== -1);

                /* Address optionals */

                assert.ok(Type.is(address.address_line_2, String));
                assert.ok(Type.is(address.access_code, String));
                assert.ok(Type.is(address.state, String));
            });

            assert.deepEqual(territories, USTerritories);
            
            done();
        });
    });
});