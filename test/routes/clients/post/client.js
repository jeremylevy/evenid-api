var assert = require('assert');
var request = require('supertest');

var async = require('async');

var config = require('../../../../config');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findOauthAuthorizations = require('../../../../testUtils/db/findOauthAuthorizations');
var findOauthClients = require('../../../../testUtils/db/findOauthClients');
var findUsers = require('../../../../testUtils/db/findUsers');

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
        authorize_test_accounts: true,
        facebook_username: 'bar',
        twitter_username: 'bar',
        instagram_username: 'bar'
    };
};
    
describe('POST /clients', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .post('/clients')
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

                if (this.accessToken) {
                    return cb(null, this.accessToken);
                }

                // Use the passed context to modify
                // user creation (isDev)
                getAppAccessToken.call(this, cb);
            };
            
            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken
            }, 400, validClient(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        makeARequest.call({
            accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
        }, 400, validClient(), /invalid_token/, done);
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 400, validClient(), /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 400, validClient(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to create client', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 403, validClient(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 when user has '
       + 'reached the maximum number of clients allowed', function (done) {

        var oldLimit = config.EVENID_USERS.MAX_ENTITIES.CLIENTS;
        var errorReg = new RegExp('access_denied'
                                  + '.*'
                                  + 'You have reached the maximum number of '
                                  + 'clients allowed per developer\\.');

        // Node.JS cache required modules, 
        // so config object is a GLOBAL var
        config.EVENID_USERS.MAX_ENTITIES.CLIENTS = 0;

        makeARequest(403, validClient(), errorReg, function (err, resp) {
            config.EVENID_USERS.MAX_ENTITIES.CLIENTS = oldLimit;

            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when required parameters are not set', function (done) {

        var reg = new RegExp('(?=.*error)(?=.*name)'
                             + '(?=.*description)(?=.*website)'
                             + '(?!.*facebook_username)(?!.*twitter_username)'
                             + '(?!.*instagram_username)');

        makeARequest(400, {}, reg, done);
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

    it('responds with HTTP code 200 and client when '
       + 'when required parameters are set without optionals', function (done) {

        var client = validClient();

        delete client.facebook_username;
        delete client.twitter_username;
        delete client.instagram_username;

        makeARequest(200, client, successReg, done);
    });

    it('responds with HTTP code 200 and disable test accounts '
       + 'when `authorize_test_accounts` was set to `false`', function (done) {

        var client = validClient();

        client.authorize_test_accounts = false;

        makeARequest(200, client, successReg, function (err, resp) {
            var createdClient = resp && resp.body;

            if (err) {
                return done(err);
            }

            findOauthClients([createdClient.id], function (err, clients) {
                var client = clients[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(clients.length, 1);

                assert.strictEqual(client.authorize_test_accounts, false);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and '
       + 'client when valid client infos', function (done) {

        var assertClientWasCreated = function (client, insertedClient) {
            Object.keys(insertedClient).forEach(function (key) {
                if (key === 'logo') {
                    assert.strictEqual(client[key], 
                                       config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                                        + '/clients/logos/' 
                                        + insertedClient.logo);
                    
                    return;
                }

                assert.strictEqual(client[key], insertedClient[key]);
            });
        };

        async.auto({
            getAppAccessToken: function (cb) {
                getAppAccessToken.call({
                    // Users may become developer 
                    // by creating a client. Test for this case.
                    isDev: false
                }, function (err, accessToken, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        user: user
                    });
                });
            },

            createClient: ['getAppAccessToken', function (cb, results) {
                var getAppAccessTokenResp = results.getAppAccessToken;
                var insertedClient = validClient();

                makeARequest.call({
                    accessToken: getAppAccessTokenResp.accessToken
                }, 200, insertedClient, successReg, function (err, resp) {
                    var client = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns created client
                    assertClientWasCreated(client, insertedClient);
                    
                    assert.ok(!!client.client_id.toString().match(/^[a-z0-9]{24}$/));

                    cb(null, client);
                });
            }],

            assertClientWasCreated: ['createClient', function (cb, results) {
                var createdClient = results.createClient;
                var insertedClient = validClient();

                findOauthClients([createdClient.id], function (err, clients) {
                    var client = clients[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assertClientWasCreated(client, insertedClient);

                    assert.ok(!!client.client_id.toString().match(/^[a-z0-9]{24}$/));
                    assert.ok(!!client.client_secret.match(/^[a-z0-9]{40}$/));

                    assert.strictEqual(client.authorize_test_accounts, true);

                    cb();
                });
            }],

            assertUserWasUpdated: ['createClient', function (cb, results) {
                var getAppAccessTokenResp = results.getAppAccessToken;
                var createdClient = results.createClient;

                findUsers([getAppAccessTokenResp.user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    assert.strictEqual(user.is_developer, true);

                    assert.strictEqual(user.developer.clients.length, 1);
                    assert.strictEqual(user.developer.clients[0].toString(),
                                       createdClient.id);

                    cb();
                });
            }],

            assertOauthAuthorizationWasUpdated: ['createClient', function (cb, results) {
                var getAppAccessTokenResp = results.getAppAccessToken;

                findOauthAuthorizations.call({
                    findConditions: {
                        issued_for: getAppAccessTokenResp.user.id
                    }
                }, [], function (err, oauthAuthorizations) {
                    var oauthAuthorization = oauthAuthorizations[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthAuthorizations.length, 1);

                    assert.ok(oauthAuthorization.scope.indexOf('app_developer') !== -1);

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