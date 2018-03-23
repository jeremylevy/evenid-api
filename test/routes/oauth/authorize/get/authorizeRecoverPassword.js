var assert = require('assert');

var request = require('supertest');
var querystring = require('querystring');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var isValidClientToSend = require('../../../../../testUtils/validators/isValidOauthAuthorizeClientToSend');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var flow = 'recover_password';

describe('GET /oauth/authorize (Recover password)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;

            client = resp.client;
            redirectionURI = resp.redirectionURI;

            makeARequest = function (done) {
                var cb = function (err, accessToken) {
                    var query = null;

                    if (err) {
                        return done(err);
                    }

                    query = {
                        client_id: client.client_id.toString(),
                        redirect_uri: redirectionURI.uri,
                        state: 'foo',
                        flow: flow
                    };

                    request(app)
                        .get('/oauth/authorize/recover-password?' + querystring.stringify(query))
                        .set('Authorization', 'Bearer ' + accessToken)
                        .expect(200, function (err, res) {
                            if (err) {
                                return done(err);
                            }

                            done(null, res.body);
                        });
                };

                getUnauthenticatedAppAccessToken(cb);
            };

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            
            done();
        });
    });

    it('responds with HTTP code 200 valid response', function (done) {
        makeARequest(function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.flow, flow);

            isValidClientToSend(resp.client, client);

            done();
        });
    });
});