var request = require('supertest');
var querystring = require('querystring');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var getNonAppAccessToken = require('../../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../../testUtils/getAppAccessToken');

var expireOauthAccessToken = require('../../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

describe('ALL /oauth/authorize (Check access token)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;

            client = resp.client;
            redirectionURI = resp.redirectionURI;

            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken) {
                    var context = this;
                    var executedMethods = 0;
                    var methods = ['GET', 'POST', 'PUT', 'DELETE'];
                    var authHeader = this.authHeader || 'Bearer ' + accessToken;
                    var query = {
                        client_id: client.client_id.toString(),
                        redirect_uri: redirectionURI.uri,
                        state: 'bar',
                        // Doesn't matter
                        flow: 'login'
                    };

                    if (err) {
                        return done(err);
                    }

                    methods.forEach(function (method) {
                        var _statusCode = statusCode;

                        if (context.statusCodes) {
                            _statusCode = context.statusCodes[method];
                        }

                        request(app)
                            [method.toLowerCase()]('/oauth/authorize?' + querystring.stringify(query))
                            .set('Authorization', authHeader)
                            .expect(body)
                            .expect(_statusCode, function (err, res) {
                                if (err) {
                                    return done(err);
                                }

                                executedMethods++;
                                
                                if (executedMethods === methods.length) {
                                    done();
                                }
                            });
                    });
                }.bind(this);

                cb(null, this.accessToken);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 400, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error '
       + 'when access token does not have authorization', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 400, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try access to oauth authorize flow', function (done) {

        getNonAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                statusCodes: {
                    'GET': 403,
                    'POST': 403,
                    /* Does not managed 
                       by oauth authorize */
                    'PUT': 404,
                    'DELETE': 404
                }
            }, null, /access_denied|not_found/, done);
        });
    });
});