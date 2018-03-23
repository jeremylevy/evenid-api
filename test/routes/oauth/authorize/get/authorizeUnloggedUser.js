var assert = require('assert');

var request = require('supertest');
var querystring = require('querystring');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');

var isValidClientToSend = require('../../../../../testUtils/validators/isValidOauthAuthorizeClientToSend');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var isValidCredentialsResp = function (flow, resp) {
    // Make sure response doesn't contain other fields
    assert.strictEqual(Object.keys(resp).length, 5);

    assert.strictEqual(resp.step, 'credentials');
    assert.strictEqual(resp.flow, flow);
    
    assert.ok(compareArray(resp.scope, redirectionURI.scope));
    assert.strictEqual(resp.installedApp, false);

    isValidClientToSend(resp.client, client);
};

describe('GET /oauth/authorize (Unlogged user)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;

            client = resp.client;
            redirectionURI = resp.redirectionURI;

            makeARequest = function (flow, done) {
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
                        .get('/oauth/authorize?' + querystring.stringify(query))
                        .set('Authorization', 'Bearer ' + accessToken)
                        .expect(200, function (err, res) {
                            if (err) {
                                return done(err);
                            }

                            done(null, res.body);
                        });
                }

                getUnauthenticatedAppAccessToken(cb);
            };
            
            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);

            done();
        });
    });

    it('responds with HTTP code 200 and `credentials`'
       + 'step reply during login flow', function (done) {
        
        var flow = 'login';

        makeARequest(flow, function (err, resp) {
            if (err) {
                return done(err);
            }

            isValidCredentialsResp(flow, resp);

            done();
        });
    });

    it('responds with HTTP code 200 and `credentials` '
       + 'step reply during registration flow', function (done) {
        
        var flow = 'registration';

        makeARequest(flow, function (err, resp) {
            if (err) {
                return done(err);
            }

            isValidCredentialsResp(flow, resp);

            done();
        });
    });
});