var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var config = require('../../../../../config');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var isInvalidRequestError = require('../../../../../testUtils/validators/isInvalidRequestError');
var isValidOauthAuthorizeSuccessRedirect = require('../../../../../testUtils/validators/isValidOauthAuthorizeSuccessRedirect');

var isValidClientToSend = require('../../../../../testUtils/validators/isValidOauthAuthorizeClientToSend');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var makeARequest = null;
var app = null;

var user = null;

var client = null;
var redirectionURI = null;

var accessToken = null;

var fullScope = null;
var fullScopeFlags = null;

var getOauthClientAccessTokenResp = null;

var testSuccessRedirect = function (needsShipBillAddress, responseType, done) {
    var scope = fullScope.join(' ');
    var scopeFlags = fullScopeFlags.join(' ');

    if (!needsShipBillAddress) {
        scope = scope.replace(/addresses\s?/, '');
        scopeFlags = scopeFlags.replace(/separate_shipping_billing_address\s?/, '');
    }

    async.auto({
        // Make sure redirection uri 
        // matches scope and response type
        updateOauthRedirectionURI: function (cb) {
            updateOauthRedirectionURI(accessToken, 
                                      client.id,
                                      redirectionURI.id,
                                      {
                                        scope: scope,
                                        scope_flags: scopeFlags, 
                                        response_type: responseType
                                      }, function (err) {

                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }
    }, function (err, results) {
        var formData = {
            shipping_address: user.addresses[0].id,
            billing_address: user.addresses[0].id
        };

        if (err) {
            return done(err);
        }

        if (!needsShipBillAddress) {
            formData = {};
        }

        makeARequest('login', formData, 200, function (err, resp) {
            var isTestAccount = false;
            var isLoggedUser = true;

            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSuccessRedirect(responseType, redirectionURI.uri, isTestAccount, 
                                                 isLoggedUser, resp, app, client, done);
        });
    });
};

describe('POST /oauth/authorize (Logged user) (Authorized user)', function () {
    before(function (done) {
        // Authorize client for user
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            getOauthClientAccessTokenResp = resp;
            app = resp.app;
            accessToken = resp.appAccessToken;
            user = resp.user;
            client = resp.client;
            redirectionURI = resp.redirectionURI;
            fullScope = resp.fullScope;
            fullScopeFlags = resp.fullScopeFlags;

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);

            makeARequest = function (flow, data, statusCode, cb) {
                var query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };
                
                request(app)
                    .post('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send(data)
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

        makeARequest(flow, {}, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.step, 'redirect_to_login_flow');
            assert.strictEqual(resp.clientName, client.name);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when scope flag `separate_shipping_billing_address` '
       + 'was set and shipping/billing addresses were not sent', function (done) {
        
        var flow = 'login';

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: 'addresses', 
                                    scope_flags: 'separate_shipping_billing_address'
                                  },
                                  function (err) {

            if (err) {
                return done(err);
            }

            makeARequest(flow, {}, 400, function (err, resp) {
                var error = null;

                if (err) {
                    return done(err);
                }

                error = resp.error;

                // `shippingBillingAddressFields`: message properties
                isInvalidRequestError(error, 
                                      getOauthClientAccessTokenResp
                                        .shippingBillingAddressFields);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and success redirection '
       + 'when shipping/billing addresses must be set and `code` '
       + 'was set as response type', function (done) {

        var needsShipBillAddress = true;

        testSuccessRedirect(needsShipBillAddress, 'code', done);
    });

    it('responds with HTTP code 200 and success redirection '
       + 'when shipping/billing addresses must be set and `token` '
       + 'was set as response type', function (done) {

        var needsShipBillAddress = true;

        testSuccessRedirect(needsShipBillAddress, 'token', done);
    });

    it('responds with HTTP code 200 and success redirection '
       + 'when shipping/billing addresses must not be set and `code` '
       + 'was set as response type', function (done) {

        var needsShipBillAddress = false;

        testSuccessRedirect(needsShipBillAddress, 'code', done);
    });

    it('responds with HTTP code 200 and success redirection '
       + 'when shipping/billing addresses must not be set and `token` '
       + 'was set as response type', function (done) {

        var needsShipBillAddress = false;

        testSuccessRedirect(needsShipBillAddress, 'token', done);
    });
});