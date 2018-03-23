var assert = require('assert');
var request = require('supertest');

var config = require('../../../config');

var GetAppAccessToken = require('../../getAppAccessToken');

module.exports = function (credentialsMedium) {
    var validCredentialsMedium = ['header', 'request'];

    assert.ok(validCredentialsMedium.indexOf(credentialsMedium) !== -1,
              'argument `credentialsMedium` is invalid. '
              + '(Must be set to: ' + validCredentialsMedium.join(', ') + ')');

    describe('POST /oauth/token (Without app client secret in ' 
             + credentialsMedium + ')', function () {

        var app = null;
        var makeARequest = null;

        var getAppAccessToken = null;
        
        before(function (done) {
            require('../../../index')(function (err, _app) {
                if (err) {
                    return done(err);
                }

                app = _app;
                getAppAccessToken = GetAppAccessToken(app);

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

        it('responds with HTTP code 401 and `invalid_client` error '
           + 'during `client_credentials` grant type', function (done) {
            
            var _request = request(app).post('/oauth/token')
                                       .set('Authorization', 
                                            credentialsMedium === 'header' 
                                                ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER_WITHOUT_SECRET
                                                : '');

            makeARequest(_request, 401, {
                client_id: credentialsMedium === 'header' 
                            ? '' 
                            : config.EVENID_APP.CLIENT_ID,

                grant_type: 'client_credentials'
            }, '{"error":"invalid_client"}', done);
        });

        it('responds with HTTP code 401 and `invalid_client` error '
           + 'during `password` grant type', function (done) {
            
            getAppAccessToken(function (err, accessToken, user) {
                var _request = request(app).post('/oauth/token')
                                           .set('Authorization', 
                                                credentialsMedium === 'header' 
                                                    ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER_WITHOUT_SECRET
                                                    : '');

                if (err) {
                    return done(err);
                }

                makeARequest(_request, 401, {
                    client_id: credentialsMedium === 'header' 
                                ? '' 
                                : config.EVENID_APP.CLIENT_ID,

                    username: user.email,
                    password: user.password,
                    grant_type: 'password'
                }, '{"error":"invalid_client"}', done);
            });
        });

        it('responds with HTTP code 401 and `invalid_client` error '
           + 'during `authorization_code` grant type', function (done) {
            
            var _request = request(app).post('/oauth/token')
                                       .set('Authorization', 
                                            credentialsMedium === 'header' 
                                                ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER_WITHOUT_SECRET
                                                : '');

            // App cannot have valid code
            makeARequest(_request, 401, {
                client_id: credentialsMedium === 'header' 
                            ? '' 
                            : config.EVENID_APP.CLIENT_ID,

                client_secret: '',
                code: 'bar',
                grant_type: 'authorization_code'
            }, '{"error":"invalid_client"}', done);
        });

        it('responds with HTTP code 401 and `invalid_client` error '
           + 'during `refresh_token` grant type', function (done) {

            getAppAccessToken(function (err, accessToken, user, refreshToken) {
                var _request = request(app).post('/oauth/token')
                                           .set('Authorization', 
                                                credentialsMedium === 'header' 
                                                    ? config.EVENID_APP.AUTHORIZATION_HTTP_HEADER_WITHOUT_SECRET
                                                    : '');

                if (err) {
                    return done(err);
                }

                makeARequest(_request, 401, {
                    client_id: credentialsMedium === 'header' 
                                ? '' 
                                : config.EVENID_APP.CLIENT_ID,

                    refresh_token: refreshToken,
                    grant_type: 'refresh_token'
                }, '{"error":"invalid_client"}', done);
            });
        });
    });
};