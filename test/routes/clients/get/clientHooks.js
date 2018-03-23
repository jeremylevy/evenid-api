var assert = require('assert');
var Type = require('type-of-is');

var request = require('supertest');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var createHook = require('../../../../testUtils/clients/createHook');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;
    
describe('GET /clients/:client_id/hooks', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, clientID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/clients/' + clientID 
                             + '/hooks')
                        .set('Authorization', authHeader)
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
                clientID: clientID
            }, 400, /invalid_request/, done);
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
                clientID: clientID
            }, 400, /invalid_token/, done);
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
                clientID: clientID
            }, 400, /invalid_token/, done);
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
                    clientID: clientID
                }, 400, /expired_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to get client hooks', function (done) {

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
                    clientID: clientID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to get client hooks which does not belong to him', function (done) {

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
                    clientID: clientID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 200 and valid hooks infos when '
       + 'developer get client hooks which belongs to him', function (done) {
        
        // Positive lookahead assertion - Negative lookahead assertion
        var reg = new RegExp('(?=.*id)(?=.*url)'
                             + '(?=.*event_type)'
                             + '(?!.*"_id")(?!.*"__v")');
        
        makeARequest(200, reg, function (err, resp) {
            var body = !err && resp.body || {};
            var hooks = body.hooks;
            var eventTypes = body.eventTypes;

            if (err) {
                return done(err);
            }

            assert.strictEqual(Object.keys(body).length, 2);
            
            assert.ok(Type.is(hooks, Array) && hooks.length > 0);
            assert.deepEqual(
                eventTypes,
                config.EVENID_OAUTH.VALID_EVENT_TYPES_FOR_HOOK
            );

            hooks.forEach(function (hook) {
                assert.strictEqual(Object.keys(hook).length, 4);
                
                assert.ok(areValidObjectIDs([hook.id]));
                assert.ok(areValidObjectIDs([hook.client]));

                assert.ok(Type.is(hook.url, String) 
                          && hook.url.length > 0);
                
                assert.ok(Type.is(hook.event_type, String) 
                          && hook.event_type.length > 0);
            });

            done();
        });
    });
});