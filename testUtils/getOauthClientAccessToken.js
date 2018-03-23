var request = require('supertest');
var querystring = require('querystring');

var clone = require('clone');
var async = require('async');

var config = require('../config');

var UpdateOauthClient = require('./clients/update');
var UpdateOauthRedirectionURI = require('./clients/updateRedirectionURI');

var FindUser = require('./users/find');

var findPhoneNumbers = require('./db/findPhoneNumbers');
var findAddresses = require('./db/findAddresses');

var oauthAuthorizeBeforeHook = require('./tests/oauthAuthorizeBeforeHook');

module.exports = function (cb) {
    var updateOauthClient = null;
    var updateOauthRedirectionURI = null;
    var findUser = null;

    var context = this;

    async.auto({
        oauthAuthorizeBeforeHook: function (cb) {
            var constructFns = function (resp) {
                updateOauthClient = UpdateOauthClient(resp.app);
                updateOauthRedirectionURI = UpdateOauthRedirectionURI(resp.app);
                findUser = FindUser(resp.app);
            };

            if (context.oauthAuthBeforeHookResp) {
                constructFns(context.oauthAuthBeforeHookResp);

                return cb(null, context.oauthAuthBeforeHookResp);
            }

            oauthAuthorizeBeforeHook(function (err, resp) {
                if (err) {
                    return cb(err);
                }

                constructFns(resp);

                cb(null, resp);
            });
        },

        updateOauthClient: ['oauthAuthorizeBeforeHook', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;

            if (!context.useTestAccount) {
                return cb(null);
            }

            updateOauthClient(resp.accessToken, resp.client.id, {
                authorize_test_accounts: 'true'
            }, function (err) {

                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Make sure scope contains all possible values
        // Make sure access token was returned in token
        updateOauthRedirectionURI: ['oauthAuthorizeBeforeHook', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;
            var update = {
                scope: (context.redirectionURIScope 
                        || resp.fullScope).join(' '),
                scope_flags: (context.redirectionURIScopeFlags 
                              || resp.fullScopeFlags).join(' '),
                response_type: context.redirectionURIResponseType || 'token'
            };

            if (context.redirectionURIURI) {
                resp.redirectionURI.uri = context.redirectionURIURI;

                update.uri = context.redirectionURIURI;
            }

            updateOauthRedirectionURI(resp.accessToken, 
                                      resp.client.id,
                                      resp.redirectionURI.id,
                                      update, function (err) {

                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        getOauthClientAccessToken: ['updateOauthClient', 
                                    'updateOauthRedirectionURI', function (cb, results) {
            
            var resp = results.oauthAuthorizeBeforeHook;
            var query = null;
            var formData = context.validFormData 
                ? context.validFormData() 
                : resp.validFormData();

            // Send the same email than those 
            // used to signup (main address)
            // Easier to test with only one email
            formData.email = resp.user.emails[0].id;

            if (context.useTestAccount) {
                formData = {};
                formData.use_test_account = 'true';

                if (context.testAccount) {
                    formData.testAccount = context.testAccount;
                }
            }

            query = {
                client_id: resp.client.client_id.toString(),
                redirect_uri: resp.redirectionURI.uri,
                state: 'bar',
                // Must set to `registration`
                // because user authorize client for the first time
                // if we set `login` it will be redirected to registration flow
                flow: context.registeredUser ? 'login' : 'registration'
            };

            request(resp.app)
                .post('/oauth/authorize?' + querystring.stringify(query))
                .set('Authorization', 'Bearer ' + resp.accessToken)
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send(formData)
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, res.body);
                });
        }],

        // Find user as viewed by client or app
        // added during `getOauthClientAccessToken` step
        getUpdatedUser: ['getOauthClientAccessToken', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;
            var oauthClientAccessToken = results.getOauthClientAccessToken;

            var accessToken = context.userAsViewedByClient 
                ? oauthClientAccessToken.redirectTo.match(/access_token=([^&]+)/)[1] 
                : resp.accessToken;

            var userID = context.userAsViewedByClient
                ? oauthClientAccessToken.redirectTo.match(/user_id=([^&]+)/)[1]
                : resp.user.id;

            findUser(accessToken, userID, function (err, user) {
                if (err) {
                    return cb(err);
                }
                
                cb(null, user);
            });
        }],

        findPhoneNumbers: ['getUpdatedUser', function (cb, results) {
            var user = results.getUpdatedUser;

            if (context.userAsViewedByClient
                || context.useTestAccount
                || user.phone_numbers.length === 0) {
                
                return cb(null);
            }

            findPhoneNumbers(user.phone_numbers, function (err, phoneNumbers) {
                if (err) {
                    return cb(err);
                }

                user.phone_numbers = phoneNumbers;

                cb(null, phoneNumbers);
            });
        }],

        findAddresses: ['getUpdatedUser', function (cb, results) {
            var user = results.getUpdatedUser;

            if (context.userAsViewedByClient
                || context.useTestAccount
                || user.addresses.length === 0) {
                
                return cb(null);
            }

            findAddresses(user.addresses, function (err, addresses) {
                if (err) {
                    return cb(err);
                }

                user.addresses = addresses;

                cb(null, addresses);
            });
        }],

        getAccessTokenForCode: ['getOauthClientAccessToken', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;
            var oauthClientAccessToken = results.getOauthClientAccessToken;

            var formData = {
                client_id: resp.client.client_id.toString(),
                client_secret: resp.client.client_secret,
                code: null,
                grant_type: 'authorization_code'
            };

            if (context.redirectionURIResponseType !== 'code'
                || context.dontUseCode) {
                
                return cb(null);
            }

            formData.code = oauthClientAccessToken.redirectTo.match(/code=([^&]+)/)[1];

            request(resp.app)
                .post('/oauth/token')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send(formData)
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, res.body);
                });
        }]
    }, function (err, results) {
        var resp = results.oauthAuthorizeBeforeHook;
        var oauthClientAccessToken = results.getOauthClientAccessToken;
        
        var codeAccessToken = results.getAccessTokenForCode;
        var updatedUser = results.getUpdatedUser;

        var app = resp.app;

        if (err) {
            return cb(err);
        }

        // Prevent modifying the passed object
        if (context.oauthAuthBeforeHookResp) {
            resp = clone(resp, true, 1);

            // Clone seems to broke app (http.server)
            // Remember `TypeError: Illegal invocation` 
            // Server.address (net.js:1390:18)
            resp.app = app;
        } else {
            resp.oauthAuthBeforeHookResp = clone(resp);

            // Clone seems to broke app (http.server)
            // Remember `TypeError: Illegal invocation` 
            // Server.address (net.js:1390:18)
            resp.oauthAuthBeforeHookResp.app = app;
        }

        resp.appAccessToken = resp.accessToken;
        
        // Keep password
        updatedUser.password = resp.user.password;

        if (context.userAsViewedByClient) {
            resp.realUser = resp.user;
        }

        resp.user = updatedUser;

        if (!context.redirectionURIResponseType
            || context.redirectionURIResponseType === 'token') {

            resp.accessToken = oauthClientAccessToken.redirectTo.match(/access_token=([^&]+)/)[1];
            resp.fakeUserID = oauthClientAccessToken.redirectTo.match(/user_id=([^&]+)/)[1];

        } else if (context.redirectionURIResponseType === 'code') {
            
            resp.code = oauthClientAccessToken.redirectTo.match(/code=([^&]+)/)[1];

            if (!context.dontUseCode) {
                resp.accessToken = codeAccessToken.access_token;
                resp.refreshToken = codeAccessToken.refresh_token;
            }
        }

        cb(null, resp);
    });
};