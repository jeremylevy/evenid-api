var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var config = require('../../../../../config');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var isValidClientToSend = require('../../../../../testUtils/validators/isValidOauthAuthorizeClientToSend');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;

describe('GET /oauth/authorize (Logged user) (All authorizations)', function () {
    before(function (done) {
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;
            accessToken = resp.appAccessToken;
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);

            makeARequest = function (flow, statusCode, cb) {
                var query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };
                
                request(app)
                    .get('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .expect(statusCode, function (err, res) {
                        var resp = null;

                        if (err) {
                            return cb(err);
                        }

                        resp = res.body;

                        cb(null, resp);
                    });
            };
            
            done();
        });
    });
    
    it('responds with HTTP code 200 and `redirect_to_login_flow` step '
       + 'reply when registered user try to register once again', function (done) {
        
        var flow = 'registration';

        makeARequest(flow, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.step, 'redirect_to_login_flow');
            
            assert.strictEqual(resp.clientName, client.name);

            done();
        });
    });

    it('responds with HTTP code 200 and `authorizations` step reply for login flow '
       + 'when scope flag `separate_shipping_billing_address` was set', function (done) {
        
        var flow = 'login';

        makeARequest(flow, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.step, 'authorizations');
            
            assert.ok(compareArray(Object.keys(resp.fieldsToAuthorize),
                                  ['shipping_address', 'billing_address']));
            
            assert.strictEqual(resp.flow, flow);

            isValidClientToSend(resp.client, client);

            done();
        });
    });

    it('responds with HTTP code 200 and `choose_account` step reply for login flow '
       + 'when scope flag `separate_shipping_billing_address` was not set', function (done) {
        
        var flow = 'login';

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {scope_flags: 'mobile_phone_number landline_phone_number'},
                                  function (err) {

            if (err) {
                return done(err);
            }

            makeARequest(flow, 200, function (err, resp) {
                if (err) {
                    return done(err);
                }
                
                assert.strictEqual(resp.step, 'choose_account');
                assert.strictEqual(resp.flow, flow);

                isValidClientToSend(resp.client, client);

                done();
            });
        });
    });
});