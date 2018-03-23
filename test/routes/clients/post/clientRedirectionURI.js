var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findOauthClients = require('../../../../testUtils/db/findOauthClients');
var findOauthRedirectionURIs = require('../../../../testUtils/db/findOauthRedirectionURIs');

var compareArray = require('../../../../testUtils/lib/compareArray');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*id)(?=.*uri)'
                          + '(?=.*response_type)(?=.*scope)'
                          + '(?!.*"_id")(?!.*"__v")');

var validRedirectionURI = function () {
    return {
        uri: 'http://bar.fr',
        response_type: 'code',
        scope: 'emails'
    };
};
    
describe('POST /clients/:client_id/redirection-uris', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, clientID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .post('/clients/' + clientID 
                              + '/redirection-uris')
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
                    return cb(null, this.accessToken, this.clientID);
                }

                createClient(cb);
            };

            getAppAccessToken = getAppAccessToken(app);
            createClient = createClient(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        createClient(function (err, accessToken, clientID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                clientID: clientID
            }, 400, validRedirectionURI(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createClient(function (err, accessToken, clientID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                clientID: clientID
            }, 400, validRedirectionURI(), /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        createClient(function (err, accessToken, clientID) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID
                }, 400, validRedirectionURI(), /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createClient(function (err, accessToken, clientID) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID
                }, 400, validRedirectionURI(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to create client redirection URI', function (done) {

        createClient(function (err, accessToken, clientID) {
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
                    clientID: clientID
                }, 403, validRedirectionURI(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to create redirect uris for client which user does not own', function (done) {

        createClient(function (err, accessToken, clientID) {
            makeARequest.call({
                accessToken: accessToken,
                clientID: '507c7f79bcf86cd7994f6c0e'
            }, 403, validRedirectionURI(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 403 when client has reached the '
       + 'maximum number of redirection uris allowed per client', function (done) {

        var oldLimit = config.EVENID_OAUTH_CLIENTS.MAX_ENTITIES.REDIRECTION_URIS;
        var errorReg = new RegExp('access_denied'
                                  + '.*'
                                  + 'You have reached the maximum number of '
                                  + 'redirection uris allowed per client\\.');

        // Node.JS cache required modules, so config object is always the SAME
        config.EVENID_OAUTH_CLIENTS.MAX_ENTITIES.REDIRECTION_URIS = 0;

        makeARequest(403, validRedirectionURI(), errorReg, function (err, resp) {
            config.EVENID_OAUTH_CLIENTS.MAX_ENTITIES.REDIRECTION_URIS = oldLimit;

            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when required parameters are not set', function (done) {

        makeARequest(400, {},
                     /(?=.*error)(?=.*uri)(?=.*response_type)(?=.*scope)/,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid URI length', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'http://'
                           + new Array(config.EVENID_OAUTH_REDIRECTION_URIS
                                             .MAX_LENGTHS
                                             .URI + 2).join('a')
                           + '.com';

        makeARequest(400, redirectionURI, 
                     /(?=.*error)(?=.*uri)(?!.*response_type)(?!.*scope)/,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when uri does not contain protocol', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'www.bar.com';

        makeARequest(400, redirectionURI, 
                     /(?=.*error)(?=.*uri)(?!.*response_type)(?!.*scope)/,
                     done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when uri contains hash', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'http://bar.com#bar';

        makeARequest(400, redirectionURI, 
                     /(?=.*error)(?=.*uri)(?!.*response_type)(?!.*scope)/,
                     done);
    });

    it('responds with HTTP code 200 and redirect URI '
       + 'when uri contains query string', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'http://bar.com?bar=bar';

        makeARequest(200, redirectionURI, successReg, done);
    });

    it('responds with HTTP code 200 and set `needs_client_secret` '
       + 'to `false` when mobile app uri', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'myapp://bar';

        makeARequest(200, redirectionURI, successReg, function (err, resp) {
            var createdRedirectionURI = resp && resp.body;

            findOauthRedirectionURIs([createdRedirectionURI.id], function (err, redirectionURIs) {
                var redirectionURI = redirectionURIs[0];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(redirectionURIs.length, 1);

                assert.strictEqual(redirectionURI.needs_client_secret, false);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and set `needs_client_secret` '
       + 'to `false` when `localhost` uri', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'http://localhost';

        makeARequest(200, redirectionURI, successReg, function (err, resp) {
            var createdRedirectionURI = resp && resp.body;

            findOauthRedirectionURIs([createdRedirectionURI.id], function (err, redirectionURIs) {
                var redirectionURI = redirectionURIs[0];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(redirectionURIs.length, 1);

                assert.strictEqual(redirectionURI.needs_client_secret, false);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and set `needs_client_secret` '
       + 'to `false` when `urn:ietf:wg:oauth:2.0:oob` uri', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'urn:ietf:wg:oauth:2.0:oob';

        makeARequest(200, redirectionURI, successReg, function (err, resp) {
            var createdRedirectionURI = resp && resp.body;

            findOauthRedirectionURIs([createdRedirectionURI.id], function (err, redirectionURIs) {
                var redirectionURI = redirectionURIs[0];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(redirectionURIs.length, 1);

                assert.strictEqual(redirectionURI.needs_client_secret, false);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and set `needs_client_secret` '
       + 'to `false` when `urn:ietf:wg:oauth:2.0:oob:auto` uri', function (done) {

        var redirectionURI = validRedirectionURI();

        redirectionURI.uri = 'urn:ietf:wg:oauth:2.0:oob:auto';

        makeARequest(200, redirectionURI, successReg, function (err, resp) {
            var createdRedirectionURI = resp && resp.body;

            findOauthRedirectionURIs([createdRedirectionURI.id], function (err, redirectionURIs) {
                var redirectionURI = redirectionURIs[0];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(redirectionURIs.length, 1);

                assert.strictEqual(redirectionURI.needs_client_secret, false);

                done();
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when token response type was used on non-https uri', function (done) {

        makeARequest(400, {
            uri: 'http://bar.com',
            response_type: 'token',
            scope: 'emails'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*response_type)(?!.*uri)(?!.*scope)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid redirect uri', function (done) {

        makeARequest(400, {
            uri: 'bar',
            response_type: 'bar',
            scope: 'bar'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*uri)(?=.*response_type)(?=.*scope)/, done);
    });

    it('responds with HTTP code 200 and redirect '
       + 'uri when valid redirect uri infos', function (done) {

        var assertRedirectionURIWasCreated = function (redirectionURI, insertedRedirectionURI) {
            Object.keys(insertedRedirectionURI).forEach(function (key) {
                if (key === 'scope') {
                    assert.ok(compareArray(redirectionURI[key], 
                                           insertedRedirectionURI[key].split(' ')));

                    return;
                }

                assert.strictEqual(redirectionURI[key], insertedRedirectionURI[key]);
            });
        };

        async.auto({
            createClient: function (cb) {
                createClient(function (err, accessToken, clientID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID
                    });
                });
            },

            createRedirectionURI: ['createClient', function (cb, results) {
                var createClientResp = results.createClient;
                var insertedRedirectionURI = validRedirectionURI();

                makeARequest.call({
                    accessToken: createClientResp.accessToken,
                    clientID: createClientResp.clientID
                }, 200, insertedRedirectionURI, successReg, function (err, resp) {
                    var redirectionURI = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns created redirection URI
                    assertRedirectionURIWasCreated(redirectionURI,
                                                   insertedRedirectionURI);

                    cb(null, resp.body);
                });
            }],

            assertRedirectionURIWasCreated: ['createRedirectionURI', function (cb, results) {
                var createdRedirectionURI = results.createRedirectionURI;
                var insertedRedirectionURI = validRedirectionURI();

                findOauthRedirectionURIs([createdRedirectionURI.id], function (err, redirectionURIs) {
                    var redirectionURI = redirectionURIs[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(redirectionURIs.length, 1);

                    assertRedirectionURIWasCreated(redirectionURI,
                                                   insertedRedirectionURI);

                    assert.strictEqual(redirectionURI.needs_client_secret, true);

                    cb();
                });
            }],

            assertClientWasUpdated: ['createRedirectionURI', function (cb, results) {
                var createdRedirectionURI = results.createRedirectionURI;
                var createClientResp = results.createClient;

                findOauthClients([createClientResp.clientID], function (err, clients) {
                    var client = clients[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assert.strictEqual(client.redirection_uris.length, 1);

                    assert.strictEqual(client.redirection_uris[0].toString(),
                                       createdRedirectionURI.id);

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