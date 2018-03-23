var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var createHook = require('../../../../testUtils/clients/createHook');

var findOauthHooks = require('../../../../testUtils/db/findOauthHooks');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

describe('DELETE /clients/:client_id/hooks/:hook_id', function () {
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
                        .delete('/clients/' + clientID 
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
            }, 400, {}, /invalid_request/, done);
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
            }, 400, {}, /invalid_token/, done);
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
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to delete client hook', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to delete hook for client which does not '
       + 'belong to him', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 404 and `not_found` error error when '
       + 'attempt to delete client hook which does not exist', function (done) {

        makeARequest.call({
            wrongHookID: '507c7f79bcf86cd7994f6c0e'
        }, 404, {}, /not_found/, done);
    });

    it('responds with HTTP code 200 when '
       + 'deleting valid hook', function (done) {

        async.auto({
            createHook: function (cb) {
                createHook(function (err, accessToken, clientID, hookID) {
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

            assertHookWasCreated: ['createHook', function (cb, results) {
                var createHookResp = results.createHook;
                var hookID = createHookResp.hookID;
                
                findOauthHooks([hookID], function (err, hooks) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(hooks.length, 1);

                    cb();
                });
            }],

            deleteHook: ['assertHookWasCreated', function (cb, results) {
                var createHookResp = results.createHook;
                var clientID = createHookResp.clientID;
                var accessToken = createHookResp.accessToken;
                var hookID = createHookResp.hookID;

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID,
                    hookID: hookID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertHookWasDeleted: ['deleteHook', function (cb, results) {
                var createHookResp = results.createHook;
                var hookID = createHookResp.hookID;

                findOauthHooks([hookID], function (err, hooks) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(hooks.length, 0);

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