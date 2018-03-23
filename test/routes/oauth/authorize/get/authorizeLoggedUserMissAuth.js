var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');
var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var isInvalidRequestError = require('../../../../../testUtils/validators/isInvalidRequestError');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var oauthAuthorizeBeforeHookResp = null;

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

var testVariousPhoneNumbersScopeCases = function (validFormData, statusCode, cb) {
    async.auto({
        // Make sure previous tests doesn't authorize client for user
        deleteAuthorizedClientForUser: function (cb) {
            deleteAuthorizedClientForUser(accessToken, user.id, client.id, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // User authorize phone number (mobile or landline)
        getOauthClientAccessToken: ['deleteAuthorizedClientForUser', function (cb) {
            var oldValidFormData = oauthAuthorizeBeforeHookResp.validFormData;

            if (validFormData) {
                oauthAuthorizeBeforeHookResp.validFormData = validFormData;
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: oauthAuthorizeBeforeHookResp,
                redirectionURIScope: ['phone_numbers'],
                redirectionURIScopeFlags: []
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Back to original value
                if (validFormData) {
                    oauthAuthorizeBeforeHookResp.validFormData = oldValidFormData;
                }

                cb(null, resp);
            });
        }],

        // User now wants specificaly landline and mobile number
        updateOauthRedirectionURI: ['getOauthClientAccessToken', function (cb) {
            updateOauthRedirectionURI(accessToken, 
                                      client.id,
                                      redirectionURI.id,
                                      {
                                        scope: 'phone_numbers',
                                        scope_flags: 'landline_phone_number mobile_phone_number'
                                      }, function (err) {

                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        makeARequest(statusCode, function (err, resp) {
            if (err) {
                return cb(err);
            }

            cb(null, resp);
        });
    });
}

describe('GET /oauth/authorize (Logged User) (Missing authorizations)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            oauthAuthorizeBeforeHookResp = resp;
            app = resp.app;
            accessToken = resp.accessToken;
            user = resp.user;
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);
            deleteAuthorizedClientForUser = deleteAuthorizedClientForUser(app);

            makeARequest = function (statusCode, cb) {
                var flow = 'login';
                var query = null;

                query = {
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
    
    it('responds with HTTP code 200 and mobile/landline phone numbers fields to authorize '
       + 'when client ask for mobile and landline phone number after it '
       + 'has asked for a phone number', function (done) {
        
        testVariousPhoneNumbersScopeCases(null, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.ok(compareArray(Object.keys(resp.fieldsToAuthorize), 
                     ['mobile_phone_number', 'landline_phone_number']));

            done();
        });
    });
    
    it('responds with HTTP code 200 and landline phone number fields to authorize '
       + 'when client ask for mobile and landline phone number after it '
       + 'has asked for a phone number and user has passed mobile number ', function (done) {

        testVariousPhoneNumbersScopeCases(function () {
            // Make sure user send a mobile phone number the first time
            return {
                phone_number_number: '+33691081784',
                phone_number_country: 'FR'
            };
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.ok(compareArray(Object.keys(resp.fieldsToAuthorize), 
                     ['landline_phone_number']));

            done();
        });
    });
    
    it('responds with HTTP code 200 and mobile phone number fields to authorize '
       + 'when client ask for mobile and landline phone number after it '
       + 'has asked for a phone number and user has passed landline number ', function (done) {

        testVariousPhoneNumbersScopeCases(function () {
            // Make sure user send a landline phone number the first time
            return {
                phone_number_number: '+33491081784',
                phone_number_country: 'FR'
            };
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assert.ok(compareArray(Object.keys(resp.fieldsToAuthorize), 
                     ['mobile_phone_number']));

            done();
        });
    });
});