var assert = require('assert');
var request = require('supertest');

var mongoose = require('mongoose');

var getAppAccessToken = require('../../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var createOauthAccessToken = require('../../../../../testUtils/db/createOauthAccessToken');
var expireOauthAccessToken = require('../../../../../testUtils/db/expireOauthAccessToken');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*id)(?=.*client_id)'
                          + '(?=.*user_id)(?=.*user_status)'
                          + '(?=.*scope)(?=.*issued_at)'
                          + '(?=.*is_expired)');

describe('GET /oauth/inspect-token', function () {
    before(function (done) {
        require('../../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken) {
                    if (err) {
                        return done(err);
                    }

                    accessToken = accessToken ? '?token=' + accessToken : '';

                    request(app)
                        .get('/oauth/inspect-token' + accessToken)
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

                return cb(null, this.accessToken);
            };

            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when token was not set', function (done) {

        makeARequest(400, /(?=.*invalid_request)(?=.*token)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid token', function (done) {

        makeARequest.call({
            accessToken: 'bar'
        }, 400, /(?=.*invalid_request)(?=.*token)/, done);
    });

    it('responds with HTTP code 404 and `not_found` '
       + 'error when token does not exist', function (done) {

        makeARequest.call({
            accessToken: '205dc70f1488ade164da09ccfa9bb373a7529d26'
        }, 404, /not_found/, done);
    });

    it('responds with HTTP code 404 and `not_found` '
       + 'error when token authorization does not exist', function (done) {

        createOauthAccessToken.call({
            authorizationID: mongoose.Types.ObjectId()
        }, function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                // Unhashed value
                accessToken: accessToken._token
            }, 404, /not_found/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error for app access tokens', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken
            }, 403, /access_denied/, done);
        });
    });

    it('responds with HTTP code 404 and `not_found` '
       + 'error when token client does not exist', function (done) {

        createOauthAccessToken.call({
            client: {
                id: mongoose.Types.ObjectId()
            }
        }, function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                // Unhashed value
                accessToken: accessToken._token
            }, 404, /not_found/, done);
        });
    });

    it('responds with HTTP code 200 and token '
       + 'information with `is_expired` set to `true '
       + 'when expired token', function (done) {

        getOauthClientAccessToken(function (err, getOauthClientAccessTokenResp) {
            if (err) {
                return done(err);
            }
            
            expireOauthAccessToken(getOauthClientAccessTokenResp.accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    // Unhashed value
                    accessToken: getOauthClientAccessTokenResp.accessToken
                }, 200, successReg, function (err, resp) {
                    var tokenInfos = resp && resp.body;

                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(tokenInfos.is_expired, true);

                    done();
                });
            });
        });
    });

    it('responds with HTTP code 200 and token '
       + 'information when valid token', function (done) {

        getOauthClientAccessToken(function (err, getOauthClientAccessTokenResp) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                // Unhashed value
                accessToken: getOauthClientAccessTokenResp.accessToken
            }, 200, successReg, function (err, resp) {
                var tokenInfos = resp && resp.body;

                if (err) {
                    return done(err);
                }

                assert.strictEqual(Object.keys(tokenInfos).length, 6);

                assert.strictEqual(tokenInfos.client_id,
                                   getOauthClientAccessTokenResp.client.client_id);

                assert.strictEqual(tokenInfos.user_id,
                                   getOauthClientAccessTokenResp.fakeUserID);

                assert.strictEqual(tokenInfos.user_status, 'new_user');

                assert.ok(compareArray(tokenInfos.scope,
                                       getOauthClientAccessTokenResp.fullScope));

                // Make sure timestamp was rounded
                assert.strictEqual(tokenInfos.issued_at % 1, 0);

                assert.ok(new Date(tokenInfos.issued_at * 1000) < new Date());

                assert.strictEqual(tokenInfos.is_expired, false);

                done();
            });
        });
    });
});