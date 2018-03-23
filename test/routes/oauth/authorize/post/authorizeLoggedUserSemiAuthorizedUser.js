var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');
var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var isInvalidRequestError = require('../../../../../testUtils/validators/isInvalidRequestError');
var isValidOauthAuthorizeSuccessRedirect = require('../../../../../testUtils/validators/isValidOauthAuthorizeSuccessRedirect');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var oauthAuthorizeBeforeHookResp = null;

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

var userMatchPassedData = null;

var testVariousCases = function (authorizeFirst, authorizeFirstFlags, 
                                 authorizeFirstData, nowWants, 
                                 nowWantsFlags, nowWantsData,
                                 nowWantsResponseType,
                                 statusCode, cb) {
    
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

        // User authorize first
        getOauthClientAccessToken: ['deleteAuthorizedClientForUser', function (cb) {
            var oldValidFormData = oauthAuthorizeBeforeHookResp.validFormData;

            if (authorizeFirstData) {
                oauthAuthorizeBeforeHookResp.validFormData = authorizeFirstData;
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: oauthAuthorizeBeforeHookResp,
                redirectionURIScope: authorizeFirst,
                redirectionURIScopeFlags: authorizeFirstFlags
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Back to original value
                if (authorizeFirstData) {
                    oauthAuthorizeBeforeHookResp.validFormData = oldValidFormData;
                }

                cb(null, resp);
            });
        }],

        // Client now wants
        updateOauthRedirectionURI: ['getOauthClientAccessToken', function (cb) {
            updateOauthRedirectionURI(accessToken, 
                                      client.id,
                                      redirectionURI.id,
                                      {
                                        scope: nowWants.join(' '),
                                        scope_flags: nowWantsFlags.join(' '),
                                        response_type: nowWantsResponseType
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

        makeARequest(statusCode, nowWantsData, function (err, resp) {
            if (err) {
                return cb(err);
            }

            cb(null, resp);
        });
    });
};

var testVariousPhoneNumbersScopeCases = function (authorizeFirstData, statusCode, cb) {
    var authorizeFirst = ['phone_numbers'];
    var authorizeFirstFlags = [];
    var nowWants = ['phone_numbers'];
    var nowWantsFlags = ['landline_phone_number', 'mobile_phone_number'];
    var nowWantsData = {};
    var nowWantsResponseType = 'token';

    testVariousCases(authorizeFirst, authorizeFirstFlags, 
                     authorizeFirstData, nowWants, 
                     nowWantsFlags, nowWantsData, nowWantsResponseType,
                     statusCode, cb);
};

describe('POST /oauth/authorize (Logged user) (Semi-authorized user)', function () {
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

            userMatchPassedData = resp.userMatchPassedData;

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);
            deleteAuthorizedClientForUser = deleteAuthorizedClientForUser(app);

            makeARequest = function (statusCode, data, cb) {
                var flow = 'login';
                var query = null;

                query = {
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
    
    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when client ask for mobile and landline phone number after '
       + 'it has asked for phone number and user doesn\'t send it', function (done) {
        
        testVariousPhoneNumbersScopeCases(function () {
            // Make sure user send a phone number 
            // which type cannot be inferred
            return {
                phone_number_number: '732-757-2923',
                phone_number_country: 'US'
            };
        }, 400, function (err, resp) {
            var error = null;

            if (err) {
                return done(err);
            }

            error = resp.error;

            isInvalidRequestError(error, oauthAuthorizeBeforeHookResp.mobileLandlinePhoneFields);

            done();
        });
    });
    
    // User has chosen a mobile phone number 
    // when client ask for phone number without specific type
    // so it has transparently authorized `mobile_phone_number`
    // scope flags
    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when client ask for mobile and landline phone number after it '
       + 'has asked for phone number and user doesn\'t send landline '
       + 'but has passed mobile number the first time it asked a phone number', function (done) {

        testVariousPhoneNumbersScopeCases(function () {
            // Make sure user send a mobile phone number the first time
            return {
                phone_number_number: '+33691081784',
                phone_number_country: 'FR'
            };
        }, 400, function (err, resp) {
            var error = null;

            if (err) {
                return done(err);
            }

            error = resp.error;

            isInvalidRequestError(error, oauthAuthorizeBeforeHookResp.landlinePhoneFields);

            done();
        });
    });
    
    // User has chosen a landline phone number 
    // when client ask for phone number without specific type
    // so it has transparently authorized `mobile_phone_number`
    // scope flags
    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when client ask for mobile and landline phone number after it '
       + 'has asked for phone number and user doesn\'t send mobile '
       + 'but has passed landline number the first time it asked a phone number', function (done) {

        testVariousPhoneNumbersScopeCases(function () {
            // Make sure user send a landline phone number the first time
            return {
                phone_number_number: '+33491081784',
                phone_number_country: 'FR'
            };
        }, 400, function (err, resp) {
            var error = null;

            if (err) {
                return done(err);
            }

            error = resp.error;

            isInvalidRequestError(error, oauthAuthorizeBeforeHookResp.mobilePhoneFields);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when client ask for billing and shipping addresses after it '
       + 'has asked for address and user doesn\'t send any address', function (done) {

        var authorizeFirst = ['addresses'];
        var authorizeFirstFlags = [];
        // Default send all possible fields
        var authorizeFirstData = null;

        var nowWants = ['addresses'];
        var nowWantsFlags = ['separate_shipping_billing_address'];
        // Don't send any address
        var nowWantsData = {};
        // Doesn't matter
        var nowWantsResponseType = 'code';

        var statusCode = 400;

        testVariousCases(authorizeFirst, authorizeFirstFlags, 
                         authorizeFirstData, nowWants, 
                         nowWantsFlags, nowWantsData,
                         nowWantsResponseType,
                         statusCode, function (err, resp) {
            
            var error = null;

            if (err) {
                return done(err);
            }

            error = resp.error;

            isInvalidRequestError(error, oauthAuthorizeBeforeHookResp.shippingBillingAddressFields);

            done();
        });
    });

    it('responds with HTTP code 200 when client ask for specificaly mobile '
       + 'phone number after it has asked for phone number and user has '
       + 'send a mobile phone number the first time', function (done) {

        var authorizeFirst = ['phone_numbers'];
        var authorizeFirstFlags = [];
        var authorizeFirstData = function () {
            // Make sure user send a 
            // mobile phone number first time
            return {
                phone_number_number: '0610293847',
                phone_number_country: 'FR'
            };
        }

        var nowWants = ['phone_numbers'];
        var nowWantsFlags = ['mobile_phone_number'];
        var nowWantsData = {};
        var nowWantsResponseType = 'code';

        var statusCode = 200;

        testVariousCases(authorizeFirst, authorizeFirstFlags, 
                         authorizeFirstData, nowWants, 
                         nowWantsFlags, nowWantsData,
                         nowWantsResponseType,
                         statusCode, function (err, resp) {
            
            var isTestAccount = false;
            var isLoggedUser = true;

            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSuccessRedirect(nowWantsResponseType, redirectionURI.uri, 
                                                 isTestAccount, 
                                                 isLoggedUser, resp, app, client, done);
        });
    });
    
    it('responds with HTTP code 200 when client ask for specificaly landline '
       + 'phone number after it has asked for phone number and user has '
       + 'send a landline phone number the first time', function (done) {

        var authorizeFirst = ['phone_numbers'];
        var authorizeFirstFlags = [];
        var authorizeFirstData = function () {
            // Make sure user send a 
            // landline phone number first time
            return {
                phone_number_number: '0491293847',
                phone_number_country: 'FR'
            };
        }

        var nowWants = ['phone_numbers'];
        var nowWantsFlags = ['landline_phone_number'];
        var nowWantsData = {};
        var nowWantsResponseType = 'code';

        var statusCode = 200;

        testVariousCases(authorizeFirst, authorizeFirstFlags, 
                         authorizeFirstData, nowWants, 
                         nowWantsFlags, nowWantsData,
                         nowWantsResponseType,
                         statusCode, function (err, resp) {
            
            var isTestAccount = false;
            var isLoggedUser = true;

            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSuccessRedirect(nowWantsResponseType, redirectionURI.uri, 
                                                 isTestAccount, 
                                                 isLoggedUser, resp, app, client, done);
        });
    });

    it('responds with HTTP code 200 when client ask '
       + 'for singular fields after it has asked for '
       + 'plural entities and user send valid fields', function (done) {

        var authorizeFirst = ['emails', 'phone_numbers', 'addresses'];
        var authorizeFirstFlags = [
            'mobile_phone_number',
            'landline_phone_number',
            'separate_shipping_billing_address'
        ];
        var authorizeFirstData = (function () {
            // Avoid `Uncaught Maximum call stack size exceeded` given
            // that `authorizeFirstData` function was set as 
            // `oauthAuthorizeBeforeHookResp.validFormData`
            var data = oauthAuthorizeBeforeHookResp.validFormData([].concat(
                oauthAuthorizeBeforeHookResp.mobileLandlinePhoneFields,
                oauthAuthorizeBeforeHookResp.shippingBillingAddressFields,
                oauthAuthorizeBeforeHookResp.emailFields
            ));

            return function () {
                return data;
            };
        })();

        var nowWants = oauthAuthorizeBeforeHookResp.singularFields;
        var nowWantsFlags = [];
        var nowWantsData = oauthAuthorizeBeforeHookResp.validFormData(
            oauthAuthorizeBeforeHookResp.singularFields
        );
        var nowWantsResponseType = 'code';

        var statusCode = 200;

        testVariousCases(authorizeFirst, authorizeFirstFlags, 
                         authorizeFirstData, nowWants, 
                         nowWantsFlags, nowWantsData,
                         nowWantsResponseType,
                         statusCode, function (err, resp) {
            
            var isTestAccount = false;
            var isLoggedUser = true;

            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSuccessRedirect(nowWantsResponseType, redirectionURI.uri, 
                                                 isTestAccount, 
                                                 isLoggedUser, resp, app, client, function (err, user) {
                if (err) {
                    return done(err);
                }

                assert.ok(userMatchPassedData(nowWantsData, user));

                done();
            });
        });
    });
    
    it('responds with HTTP code 200 when client ask '
       + 'for plural entities after it has asked for '
       + 'singular fields and user send valid fields', function (done) {

        var authorizeFirst = oauthAuthorizeBeforeHookResp.singularFields;
        var authorizeFirstFlags = [];
        var authorizeFirstData = (function () {
            // Avoid `Uncaught Maximum call stack size exceeded` given
            // that `authorizeFirstData` function was set as 
            // `oauthAuthorizeBeforeHookResp.validFormData`
            var data = oauthAuthorizeBeforeHookResp.validFormData(
                oauthAuthorizeBeforeHookResp.singularFields
            );

            return function () {
                return data;
            };
        })();

        var nowWants = ['emails', 'phone_numbers', 'addresses'];
        var nowWantsFlags = [
            'mobile_phone_number',
            'landline_phone_number',
            'separate_shipping_billing_address'
        ];
        var nowWantsData = oauthAuthorizeBeforeHookResp.validFormData([].concat(
            oauthAuthorizeBeforeHookResp.mobileLandlinePhoneFields,
            oauthAuthorizeBeforeHookResp.shippingBillingAddressFields,
            oauthAuthorizeBeforeHookResp.emailFields
        ));
        var nowWantsResponseType = 'token';

        var statusCode = 200;

        testVariousCases(authorizeFirst, authorizeFirstFlags, 
                         authorizeFirstData, nowWants, 
                         nowWantsFlags, nowWantsData,
                         nowWantsResponseType,
                         statusCode, function (err, resp) {
            
            var isTestAccount = false;
            var isLoggedUser = true;

            if (err) {
                return done(err);
            }

            isValidOauthAuthorizeSuccessRedirect(nowWantsResponseType, redirectionURI.uri, 
                                                 isTestAccount, 
                                                 isLoggedUser, resp, app, client, function (err, user) {
                if (err) {
                    return done(err);
                }

                assert.ok(userMatchPassedData(nowWantsData, user));

                done();
            });
        });
    });
});