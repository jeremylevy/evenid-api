var assert = require('assert');
var request = require('supertest');

var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var localesData = require('../../../../locales/data');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createPhoneNumber = require('../../../../testUtils/users/createPhoneNumber');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var USTerritories = localesData['en-us'].territories;

var makeARequest = null;
var app = null;
    
describe('GET /users/:user_id/phone-numbers/:phone_number_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, userID, phoneNumberID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/users/' + userID 
                             + '/phone-numbers/' 
                             + (this.wrongPhoneNumberID || phoneNumberID))
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
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createPhoneNumber(function (err, accessToken, userID, phoneNumberID) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                phoneNumberID: phoneNumberID
            }, 400, /invalid_token/, done);
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
                }, 400, /expired_token/, done);
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
                }, 400, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to get user phone number', function (done) {

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
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to get phone number which does not belong to him', function (done) {

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
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to get invalid user phone number', function (done) {

        makeARequest.call({
            wrongPhoneNumberID: '507c7f79bcf86cd7994f6c0e'
        }, 403, /(?=.*error)/, done);
    });

    it('responds with HTTP code 200 and user phone number when '
       + 'getting valid user phone number', function (done) {
        
        // Positive lookahead assertion - Negative lookahead assertion
        var reg = new RegExp('(?=.*\\{)(?=.*id)'
                             + '(?=.*number)(?=.*international_number)'
                             + '(?=.*country)(?=.*phone_type)'
                             // Resp sent as
                             // {phoneNumber: ..., territories: ...}
                             + '(?=.*phoneNumber)(?=.*territories)'
                             + '(?!.*"_id")(?!.*"__v")');
        
        makeARequest(200, reg, function (err, resp) {
            var body = !err && resp.body || {};
            var phoneNumber = body.phoneNumber;
            var territories = body.territories;

            if (err) {
                return done(err);
            }

            // {phoneNumber: {...}, territories: {...}}
            assert.strictEqual(Object.keys(body).length, 2);

            assert.strictEqual(Object.keys(phoneNumber).length, 5);
            
            assert.ok(areValidObjectIDs([phoneNumber.id]));

            assert.ok(Type.is(phoneNumber.number, String) 
                      && phoneNumber.number.length > 0);

            assert.ok(Type.is(phoneNumber.international_number, String) 
                      && phoneNumber.international_number.length > 0);

            assert.ok(Type.is(phoneNumber.country, String) 
                      && phoneNumber.country.length > 0);

            assert.ok(Type.is(phoneNumber.phone_type, String) 
                      && phoneNumber.phone_type.length > 0);

            assert.deepEqual(territories, USTerritories);
            
            done();
        });
    });
});