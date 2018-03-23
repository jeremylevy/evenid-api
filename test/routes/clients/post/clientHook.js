var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var createHook = require('../../../../testUtils/clients/createHook');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findOauthClients = require('../../../../testUtils/db/findOauthClients');
var findOauthHooks = require('../../../../testUtils/db/findOauthHooks');

var makeARequest = null;
var app = null;

var successReg = new RegExp('(?=.*id)(?=.*url)'
                          + '(?=.*event_type)'
                          + '(?!.*"_id")(?!.*"__v")');

var validHook = function () {
    return {
        url: 'http://foo.fr',
        // We want to assert that 
        // client `update_notification_handler` 
        // property was updated.
        event_type: 'USER_DID_UPDATE_PERSONAL_INFORMATION'
    };
};
    
describe('POST /clients/:client_id/hooks', function () {
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
                              + '/hooks')
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
            createHook = createHook(app, createClient);

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
            }, 400, validHook(), /invalid_request/, done);
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
            }, 400, validHook(), /invalid_token/, done);
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
                }, 400, validHook(), /expired_token/, done);
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
                }, 400, validHook(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error '
       + 'when non-developer try to create client hook', function (done) {

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
                    clientID: clientID,
                    accessToken: accessToken
                }, 403, validHook(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to create hook for client which does not belong to him', function (done) {

        createClient(function (err, accessToken, clientID) {
            makeARequest.call({
                accessToken: accessToken,
                clientID: '507c7f79bcf86cd7994f6c0e'
            }, 403, validHook(), /access_denied/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'developer try to create a hook for an already managed event', function (done) {

        createHook.call({
            eventType: 'USER_DID_UPDATE_PERSONAL_INFORMATION'
        }, function (err, accessToken, clientID, hookID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                clientID: clientID
            }, 400, validHook(), 
            /(?=.*invalid_request)(?=.*event_type)(?=.*already managed)/,
            done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid hook', function (done) {

        makeARequest(400, {
            url: 'http://foo',
            event_type: 'foo'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*url)(?=.*event_type)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid URL length', function (done) {

        var hook = validHook();

        hook.url = 'http://'
                 + new Array(config.EVENID_OAUTH_HOOKS
                                   .MAX_LENGTHS
                                   .URL + 2).join('a')
                 + '.com';

        makeARequest(400, hook, 
                     /(?=.*error)(?=.*url)(?!.*event_type)/,
                     done);
    });

    it('responds with HTTP code 200 and hook when '
       + 'valid hook infos', function (done) {

        var assertHookWasCreated = function (hook, insertedHook) {
            Object.keys(insertedHook).forEach(function (key) {
                assert.strictEqual(hook[key], insertedHook[key]);
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

            createHook: ['createClient', function (cb, results) {
                var createClientResp = results.createClient;
                var insertedHook = validHook();

                makeARequest.call({
                    accessToken: createClientResp.accessToken,
                    clientID: createClientResp.clientID
                }, 200, insertedHook, successReg, function (err, resp) {
                    var hook = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns created hook
                    assertHookWasCreated(hook, insertedHook);

                    cb(null, resp.body);
                });
            }],

            assertHookWasCreated: ['createHook', function (cb, results) {
                var createdHook = results.createHook;
                var insertedHook = validHook();

                findOauthHooks([createdHook.id], function (err, hooks) {
                    var hook = hooks[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(hooks.length, 1);

                    assertHookWasCreated(hook, insertedHook);

                    cb();
                });
            }],

            assertClientWasUpdated: ['createHook', function (cb, results) {
                var createdHook = results.createHook;
                var createClientResp = results.createClient;

                findOauthClients([createClientResp.clientID], function (err, clients) {
                    var client = clients[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assert.strictEqual(client.hooks.length, 1);
                    assert.strictEqual(client.hooks[0].toString(), createdHook.id);

                    assert.strictEqual(client.update_notification_handler, createdHook.url);

                    cb();
                });
            }],

            /* We want to assert that client `update_notification_handler` 
               property may be set to `undefined`. */

            recreateClient: ['assertHookWasCreated',
                             'assertClientWasUpdated',
                             function (cb) {
                
                createClient(function (err, accessToken, clientID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID
                    });
                });
            }],

            recreateHook: ['recreateClient', function (cb, results) {
                var createClientResp = results.recreateClient;

                makeARequest.call({
                    accessToken: createClientResp.accessToken,
                    clientID: createClientResp.clientID
                }, 200, {
                    url: 'http://foo.fr',
                    event_type: 'USER_DID_REVOKE_ACCESS'
                }, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp.body);
                });
            }],

            // assert that client `update_notification_handler` 
            // property was set to `undefined`.
            reassertClientWasUpdated: ['recreateHook', function (cb, results) {
                var createClientResp = results.recreateClient;

                findOauthClients([createClientResp.clientID], function (err, clients) {
                    var client = clients[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assert.strictEqual(client.update_notification_handler, undefined);

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