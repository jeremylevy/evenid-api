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
        // We update from `USER_DID_REVOKE_ACCESS`
        // to `USER_DID_UPDATE_PERSONAL_INFORMATION` to 
        // assert that client `update_notification_handler` 
        // property was updated.
        event_type: 'USER_DID_UPDATE_PERSONAL_INFORMATION'
    };
};
    
describe('PUT /clients/:client_id/hooks/:hook_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, clientID, hookID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .put('/clients/' + clientID 
                             + '/hooks/' 
                             + (this.wrongHookID || hookID))
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
                    return cb(null, this.accessToken, this.clientID, this.hookID);
                }

                createHook(cb);
            };

            getAppAccessToken = getAppAccessToken(app);
            createClient = createClient(app, getAppAccessToken);
            createHook = createHook(app, createClient);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        createHook(function (err, accessToken, clientID, hookID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                clientID: clientID,
                hookID: hookID
            }, 400, validHook(), /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createHook(function (err, accessToken, clientID, hookID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                clientID: clientID,
                hookID: hookID
            }, 400, validHook(), /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        createHook(function (err, accessToken, clientID, hookID) {
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
                    hookID: hookID
                }, 400, {}, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createHook(function (err, accessToken, clientID, hookID) {
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
                    hookID: hookID
                }, 400, validHook(), /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to update client hook URI', function (done) {

        createHook(function (err, accessToken, clientID, hookID) {
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
                    hookID: hookID
                }, 403, validHook(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to modify client hook which does not belong to him', function (done) {

        createHook(function (err, accessToken, clientID, hookID) {
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
                    hookID: hookID
                }, 403, validHook(), /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 404 and `not_found` error error when '
       + 'attempt to modify client hooks which does not exist', function (done) {

        makeARequest.call({
            wrongHookID: '507c7f79bcf86cd7994f6c0e'
        }, 404, validHook(), /not_found/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` error when developer try '
       + 'to updated a hook with an already managed event', function (done) {

        async.auto({
            createHook: function (cb) {
                createHook.call({
                    eventType: 'USER_DID_REVOKE_ACCESS',
                }, function (err, accessToken, clientID, hookID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        hookID: hookID
                    });
                });
            },

            createHook2: ['createHook', function (cb, results) {
                var createHookResp = results.createHook;

                createHook.call({
                    accessToken: createHookResp.accessToken,
                    clientID: createHookResp.clientID,
                    eventType: 'USER_DID_UPDATE_PERSONAL_INFORMATION'
                }, function (err, accessToken, clientID, hookID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        hookID: hookID
                    });
                });
            }]
        }, function (err, results) {
            var createHook2Resp = results && results.createHook2;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: createHook2Resp.accessToken,
                clientID: createHook2Resp.clientID,
                hookID: createHook2Resp.hookID
            }, 400, {
                event_type: 'USER_DID_REVOKE_ACCESS'
            }, /(?=.*invalid_request)(?=.*event_type)(?=.*already managed)/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'invalid hook infos', function (done) {

        makeARequest(400, {
            url: 'goo',
            event_type: 'bar'
            // Positive lookahead assertion
        }, /(?=.*error)(?=.*url)(?=.*event_type)/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid URL length', function (done) {

        makeARequest(400, {
            url: 'http://'
                + new Array(config.EVENID_OAUTH_HOOKS
                                  .MAX_LENGTHS
                                  .URL + 2).join('a')
                + '.com'
        }, /(?=.*error)(?=.*url)(?!.*event_type)/, done);
    });

    it('responds with HTTP code 200 and hook when '
       + 'valid hook infos', function (done) {

        var assertHookWasUpdated = function (hook, updatedHook) {
            Object.keys(updatedHook).forEach(function (key) {
                assert.strictEqual(hook[key], updatedHook[key]);
            });
        };

        async.auto({
            createHook: function (cb) {
                createHook.call({
                    // We update from `USER_DID_REVOKE_ACCESS`
                    // to `USER_DID_UPDATE_PERSONAL_INFORMATION` to 
                    // assert that client `update_notification_handler` 
                    // property was updated.
                    eventType: 'USER_DID_REVOKE_ACCESS'
                }, function (err, accessToken, clientID, hookID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        hookID: hookID
                    });
                });
            },

            updateHook: ['createHook', function (cb, results) {
                var createHookResp = results.createHook;
                var updatedHook = validHook();

                makeARequest.call({
                    accessToken: createHookResp.accessToken,
                    clientID: createHookResp.clientID,
                    hookID: createHookResp.hookID
                }, 200, updatedHook, successReg, function (err, resp) {
                    var hook = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    // Assert it returns the updated hook
                    assertHookWasUpdated(hook, updatedHook);

                    cb(null, hook);
                });
            }],

            assertHookWasUpdated: ['updateHook', function (cb, results) {
                var updatedHookID = results.updateHook.id;
                var updatedHook = validHook();

                findOauthHooks([updatedHookID], function (err, hooks) {
                    var hook = hooks[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(hooks.length, 1);

                    assertHookWasUpdated(hook, updatedHook);

                    cb();
                });
            }],

            // assert that client `update_notification_handler` 
            // property was set to hook URL.
            assertClientWasUpdated: ['updateHook', function (cb, results) {
                var createHookResp = results.createHook;
                var updatedHook = results.updateHook;

                findOauthClients([createHookResp.clientID], function (err, clients) {
                    var client = clients[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assert.strictEqual(client.update_notification_handler, updatedHook.url);

                    cb();
                });
            }],

            /* We want to assert that client `update_notification_handler` 
               property may be set to `undefined`. */

            reupdateHook: ['assertHookWasUpdated', 'assertClientWasUpdated', function (cb, results) {
                var createHookResp = results.createHook;

                makeARequest.call({
                    accessToken: createHookResp.accessToken,
                    clientID: createHookResp.clientID,
                    hookID: createHookResp.hookID
                }, 200, {
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
            reassertClientWasUpdated: ['reupdateHook', function (cb, results) {
                var createHookResp = results.createHook;

                findOauthClients([createHookResp.clientID], function (err, clients) {
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