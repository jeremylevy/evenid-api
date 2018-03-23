var assert = require('assert');
var request = require('supertest');

var async = require('async');

var config = require('../../../config');

var createHash = require('../../../libs/createHash');

var findOauthAccessTokens = require('../../../testUtils/db/findOauthAccessTokens');

var successRespReg = new RegExp('(?=.*access_token)(?=.*token_type)'
                              + '(?=.*expires_in)(?=.*refresh_token)'
                              // No users involved
                              + '(?!.*user_id)(?!.*user_status)');

module.exports = function (credentialsMedium) {
    var validCredentialsMedium = ['header', 'request'];

    assert.ok(validCredentialsMedium.indexOf(credentialsMedium) !== -1,
              'argument `credentialsMedium` is invalid. '
              + '(Must be set to: ' + validCredentialsMedium.join(', ') + ')');

    describe('POST /oauth/token (Client credentials grant type) '
             + '(Client credentials in ' + credentialsMedium + ')', function () {

        var app = null;
        var makeARequest = null;
        
        before(function (done) {
            require('../../../index')(function (err, _app) {
                if (err) {
                    return done(err);
                }

                app = _app;

                makeARequest = function (_request, statusCode, data, body, done) {
                    _request = _request || request(app).post('/oauth/token');

                    _request
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
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
                };

                done();
            });
        });

        /* Invalid client credentials and when 
           non-app client try to use `client_credentials`
           grant type errors are tested in `checkClient` */

        it('responds with HTTP code 200 and access token when '
           + 'valid client credentials', function (done) {

            async.auto({
                getAccessToken: function (cb) {
                    var _request = request(app).post('/oauth/token')
                                               .set('Authorization', 
                                                    credentialsMedium === 'header' 
                                                        ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER 
                                                        : '');

                    makeARequest(_request, 200, {
                        client_id: credentialsMedium === 'header' 
                                    ? '' 
                                    : config.EVENID_APP.CLIENT_ID,

                        client_secret: credentialsMedium === 'header' 
                                        ? '' 
                                        : config.EVENID_APP.CLIENT_SECRET,

                        grant_type: 'client_credentials'
                    }, successRespReg, function (err, resp) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, resp.body);
                    });
                },

                assertAuthAndAccessTokenWereInserted: ['getAccessToken', function (cb, results) {
                    var resp = results.getAccessToken;

                    findOauthAccessTokens.call({
                        populateAuthorization: true,

                        findConditions: {
                            token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.access_token
                            ),

                            refresh_token: createHash(
                                config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                resp.refresh_token
                            )
                        }
                    }, [], function (err, oauthAccessTokens) {
                        var oauthAccessToken = oauthAccessTokens[0];

                        if (err) {
                            return cb(err);
                        }

                        assert.strictEqual(oauthAccessTokens.length, 1);

                        assert.ok(!!oauthAccessToken.authorization._id);

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
};