var request = require('supertest');
var querystring = require('querystring');

var async = require('async');

var config = require('../config');

var oauthAuthorizeBeforeHook = require('./tests/oauthAuthorizeBeforeHook');

var getUnauthenticatedAppAccessToken = require('./getUnauthenticatedAppAccessToken');

var updateOauthRedirectionURI = require('./clients/updateRedirectionURI');

module.exports = function (cb) {
    async.auto({
        oauthAuthorizeBeforeHook: function (cb) {
            oauthAuthorizeBeforeHook(function (err, resp) {
                if (err) {
                    return cb(err);
                }

                updateOauthRedirectionURI = updateOauthRedirectionURI(resp.app);
                getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(resp.app);

                cb(null, resp);
            });
        },

        getUnauthenticatedAppAccessToken: ['oauthAuthorizeBeforeHook', function (cb) {
            getUnauthenticatedAppAccessToken(function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                cb(null, accessToken);
            });
        }],

        updateOauthRedirectionURI: ['oauthAuthorizeBeforeHook', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;

            updateOauthRedirectionURI(resp.accessToken, 
                                      resp.client.id,
                                      resp.redirectionURI.id,
                                      {scope: resp.fullScope.join(' ')}, function (err) {

                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        loginOnClient: ['getUnauthenticatedAppAccessToken',
                        'updateOauthRedirectionURI', function (cb, results) {
            
            var accessToken = results.getUnauthenticatedAppAccessToken;
            var resp = results.oauthAuthorizeBeforeHook;

            var flow = 'login';
            var query = null;

            query = {
                client_id: resp.client.client_id.toString(),
                redirect_uri: resp.redirectionURI.uri,
                state: 'foo',
                flow: flow
            };

            request(resp.app)
                .post('/oauth/authorize?' + querystring.stringify(query))
                .set('Authorization', 'Bearer ' + accessToken)
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                    email: resp.user.email,
                    password: resp.user.password
                })
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, res.body);
                });
        }]
    }, function (err, results) {
        var resp = results.oauthAuthorizeBeforeHook;
        var loginResp = results.loginOnClient;

        if (err) {
            return cb(err);
        }
        
        resp.accessToken = loginResp.accessToken.access_token;

        cb(null, resp);
    });
};