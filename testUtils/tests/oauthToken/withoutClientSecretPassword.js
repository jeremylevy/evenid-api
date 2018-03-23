var assert = require('assert');
var request = require('supertest');

var getOauthClientAccessToken = require('../../../testUtils/getOauthClientAccessToken');

var successReg = new RegExp('(?=.*access_token)(?=.*token_type)'
                          + '(?=.*expires_in)(?=.*refresh_token)'
                          + '(?=.*user_id)(?=.*user_status)');

var authorizationHeader = function (clientID) {
    return 'Basic ' 
        + new Buffer(clientID + ':').toString('base64');
};

module.exports = function (credentialsMedium) {
    var validCredentialsMedium = ['header', 'request'];

    assert.ok(validCredentialsMedium.indexOf(credentialsMedium) !== -1,
              'argument `credentialsMedium` is invalid. '
              + '(Must be set to: ' + validCredentialsMedium.join(', ') + ')');

    describe('POST /oauth/token (Password) (Without client secret in ' 
             + credentialsMedium + ')', function () {

        var app = null;
        var makeARequest = null;

        var testWithVariousURI = function (URI, done) {
            getOauthClientAccessToken.call({
                redirectionURIURI: URI,
                // Token response type is 
                // only available for https uris
                redirectionURIResponseType: 'code'
            }, function (err, resp) {
                if (err) {
                    return done(err);
                }

                var _request = request(app).post('/oauth/token')
                                           .set('Authorization', 
                                                credentialsMedium === 'header' 
                                                    ? authorizationHeader(resp.client.client_id)
                                                    : '');

                makeARequest(_request, 400, {
                    client_id: credentialsMedium === 'header' 
                                ? '' 
                                : resp.client.client_id,

                    username: resp.user.email,
                    password: resp.user.password,
                    grant_type: 'password'
                }, '{"error":"unauthorized_client"}', done);
            });
        };
        
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
        
        it('responds with HTTP code 400 and `unauthorized_client` '
           + 'error when client needs secret', function (done) {

            testWithVariousURI('http://bar.com', done);
        });

        it('responds with HTTP code 400 and `unauthorized_client` '
           + 'when using mobile app uri', function (done) {
            
            testWithVariousURI('myapp://bar', done);
        });

        it('responds with HTTP code 400 and `unauthorized_client` '
           + 'when using localhost uri during', function (done) {
            
            testWithVariousURI('http://localhost', done);
        });

        it('responds with HTTP code 400 and `unauthorized_client` '
           + 'when using `urn:ietf:wg:oauth:2.0:oob` uri', function (done) {
            
            testWithVariousURI('urn:ietf:wg:oauth:2.0:oob', done);
        });

        it('responds with HTTP code 400 and `unauthorized_client` '
           + 'when using `urn:ietf:wg:oauth:2.0:oob:auto` uri', function (done) {
            
            testWithVariousURI('urn:ietf:wg:oauth:2.0:oob:auto', done);
        });
    });
};