var assert = require('assert');
var request = require('supertest');

var async = require('async');

var config = require('../../../../config');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findOauthClients = require('../../../../testUtils/db/findOauthClients');

var makeARequest = null;
var app = null;

// Positive lookahead assertion - Negative lookahead assertion
var successReg = new RegExp('(?=.*client_id)'
                          + '(?=.*name)(?=.*description)'
                          + '(?=.*website)(?=.*facebook)'
                          + '(?=.*twitter)(?=.*instagram)'
                          + '(?!.*client_secret)'
                          + '(?!.*"redirection_uris")(?!.*hooks)'
                          + '(?!.*"_id")(?!.*"__v")');

var validClient = function () {
    return {
        name: 'bar',
        description: 'Foo is awesome', 
        website: 'http://foo.fr', 
        logo: '034e38fcafd01c52242d406625d9d33eaea35263',
        facebook_username: 'bar',
        twitter_username: 'bar',
        instagram_username: 'bar'
    };
};
    
describe('PUT /clients/:client_id', function () {
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
                        .put('/clients/' + clientID)
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
            }, 400, validClient(), /invalid_request/, done);
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
            }, 400, validClient(), /invalid_token/, done);
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
                }, 400, validClient(), /expired_token/, done);
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
                }, 400, validClient(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to update client', function (done) {

        createClient(function (err, accessToken, clientID) {
            getAppAccessToken.call({
                isDev: false
            }, function (err, accessToken) {
                makeARequest.call({
                    accessToken:accessToken,
                    clientID: clientID
                }, 403, validClient(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and access denied when '
       + 'developer try to update client that he doesn\'t own', function (done) {

        createClient(function (err, accessToken, clientID) {
            getAppAccessToken.call({
                isDev: true
            }, function (err, accessToken) {
                makeARequest.call({ 
                    accessToken:accessToken,
                    clientID: clientID
                }, 403, validClient(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when invalid client values were passed', function (done) {

                            // Positive lookahead assertion
        var reg = new RegExp('(?=.*error)(?=.*name)'
                            +'(?=.*description)(?=.*website)'
                            +'(?=.*facebook_username)(?=.*twitter_username)'
                            +'(?=.*instagram_username)'
                            // Negative lookahead assertion
                            +'(?!.*client_id)(?!.*client_secret)'
                            +'(?!.*"redirection_uris")(?!.*hooks)'
                            +'(?!.*"_id")'
                            +'(?!.*"__v")');

        makeARequest(400, {
            // '+2': for first and last elements
            name: new Array(config.EVENID_OAUTH_CLIENTS
                                  .MAX_LENGTHS
                                  .NAME + 2).join('a'),

            description: new Array(config.EVENID_OAUTH_CLIENTS
                                         .MAX_LENGTHS
                                         .DESCRIPTION + 2).join('a'),

            website: 'http://' + new Array(config.EVENID_OAUTH_CLIENTS
                                                 .MAX_LENGTHS
                                                 .WEBSITE + 2).join('a') + '.com',

            facebook_username: new Array(config.EVENID_OAUTH_CLIENTS
                                               .MAX_LENGTHS
                                               .FACEBOOK_USERNAME + 2).join('a'),

            twitter_username: new Array(config.EVENID_OAUTH_CLIENTS
                                              .MAX_LENGTHS
                                              .TWITTER_USERNAME + 2).join('a'),

            instagram_username: new Array(config.EVENID_OAUTH_CLIENTS
                                                .MAX_LENGTHS
                                                .INSTAGRAM_USERNAME + 2).join('a')
        }, reg, done);
    });
    
    it('responds with HTTP code 400 and `invalid_request` error '
       + 'when invalid client website was passed', function (done) {

                              // Positive lookahead assertion
        var reg = new RegExp('(?=.*error)(?=.*website)'
                            // Negative lookahead assertion
                            +'(?!.*client_id)(?!.*client_secret)'
                            +'(?!.*"redirection_uris")(?!.*hooks)'
                            +'(?!.*"_id")'
                            +'(?!.*"__v")');

        makeARequest(400, {
            website: 'bar'
        }, reg, done);
    });

    it('responds with HTTP code 200 and updated client when '
       + 'valid client values were passed', function (done) {

        var assertClientWasUpdated = function (client, updatedClient) {
            Object.keys(updatedClient).forEach(function (key) {
                if (key === 'logo') {
                    assert.strictEqual(client[key], 
                                       config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                                        + '/clients/logos/' 
                                        + updatedClient.logo);
                    
                    return;
                }

                assert.strictEqual(client[key], updatedClient[key]);
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

            updateClient: ['createClient', function (cb, results) {
                var createClientResp = results.createClient;
                var updatedClient = validClient();

                makeARequest.call({
                    accessToken: createClientResp.accessToken,
                    clientID: createClientResp.clientID
                }, 200, updatedClient, successReg, function (err, resp) {
                    var client = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }
                    
                    // Assert it returns updated client
                    assertClientWasUpdated(client, updatedClient);

                    cb(null, resp.body);
                });
            }],

            assertClientWasUpdated: ['updateClient', function (cb, results) {
                var updatedClientID = results.updateClient.id;
                var updatedClient = validClient();

                findOauthClients([updatedClientID], function (err, clients) {
                    var client = clients[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assertClientWasUpdated(client, updatedClient);

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