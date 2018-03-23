var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var createRedirectionURI = require('../../../../testUtils/clients/createRedirectionURI');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findOauthRedirectionURIs = require('../../../../testUtils/db/findOauthRedirectionURIs');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*id)(?=.*uri)'
                          + '(?=.*response_type)'
                          + '(?!.*"_id")(?!.*"__v")');

var validRedirectionURI = function () {
    return {
        uri: 'http://foo.fr',
        response_type: 'code'
    };
};
    
describe('PUT /clients/:client_id/redirection-uris/:redirection_uri_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, clientID, redirectionURIID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .put('/clients/' + clientID 
                             + '/redirection-uris/' 
                             + (this.wrongRedirectionURIID || redirectionURIID))
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
                        .set('Authorization', authHeader)
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
                }.bind(this);

                if (this.clientID) {
                    return cb(null, this.accessToken, this.clientID, this.redirectionURIID);
                }

                createRedirectionURI(cb);
            };

            getAppAccessToken = getAppAccessToken(app);
            createClient = createClient(app, getAppAccessToken);
            createRedirectionURI = createRedirectionURI(app, createClient);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                clientID: clientID,
                redirectionURIID: redirectionURIID
            }, 400, validRedirectionURI(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                clientID: clientID,
                redirectionURI: redirectionURIID
            }, 400, validRedirectionURI(), /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
                }, 400, validRedirectionURI(), /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
                }, 400, validRedirectionURI(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to update client redirection URI', function (done) {

        createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
            if (err) {
                return done(err);
            }

            getAppAccessToken.call({
                isDev: false
            }, function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
                }, 403, validRedirectionURI(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to modify client redirection URI which does not belong to him', function (done) {

        createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
            if (err) {
                return done(err);
            }

            getAppAccessToken.call({
                isDev: true
            }, function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
                }, 403, validRedirectionURI(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 404 and `not_found` error error when '
       + 'attempt to modify client redirection URI which does not exist', function (done) {

        makeARequest.call({
            wrongRedirectionURIID: '507c7f79bcf86cd7994f6c0e'
        }, 404, validRedirectionURI(), /not_found/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'invalid redirect uri infos', function (done) {

        makeARequest(400, {
            uri: 'goo'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*uri)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid URI length', function (done) {

        makeARequest(400, {
            uri: 'http://'
                + new Array(config.EVENID_OAUTH_REDIRECTION_URIS
                                  .MAX_LENGTHS
                                  .URI + 2).join('a')
                + '.com'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*uri)/, done);
    });

    it('responds with HTTP code 200 and redirect uri when '
       + 'valid redirect uri infos', function (done) {

        var assertRedirectionURIWasUpdated = function (redirectionURI, updatedRedirectionURI) {
            Object.keys(updatedRedirectionURI).forEach(function (key) {
                assert.strictEqual(redirectionURI[key], updatedRedirectionURI[key]);
            });
        };

        async.auto({
            createRedirectionURI: function (cb) {
                createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        redirectionURIID: redirectionURIID
                    });
                });
            },

            updateRedirectionURI: ['createRedirectionURI', function (cb, results) {
                var createRedirectionURIResp = results.createRedirectionURI;
                var updatedRedirectionURI = validRedirectionURI();

                makeARequest.call({
                    accessToken: createRedirectionURIResp.accessToken,
                    clientID: createRedirectionURIResp.clientID,
                    redirectionURIID: createRedirectionURIResp.redirectionURIID
                }, 200, updatedRedirectionURI, successReg, function (err, resp) {
                    var redirectionURI = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns 
                    // the updated redirection URI
                    assertRedirectionURIWasUpdated(redirectionURI, updatedRedirectionURI);

                    cb(null, resp.body);
                });
            }],

            assertRedirectionURIWasUpdated: ['updateRedirectionURI', function (cb, results) {
                var updatedRedirectionURIID = results.updateRedirectionURI.id;
                var updatedRedirectionURI = validRedirectionURI();

                findOauthRedirectionURIs([updatedRedirectionURIID], function (err, redirectionURIs) {
                    var redirectionURI = redirectionURIs[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(redirectionURIs.length, 1);

                    assertRedirectionURIWasUpdated(redirectionURI, updatedRedirectionURI);

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});