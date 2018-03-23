var assert = require('assert');
var Type = require('type-of-is');

var request = require('supertest');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

describe('GET /clients/:client_id', function () {
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
                        .get('/clients/' + clientID)
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
            }, 400, /invalid_request/, done);
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
            }, 400, /invalid_token/, done);
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
                }, 400, /expired_token/, done);
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
                }, 400, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to get client', function (done) {

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
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and error when '
       + 'developer try to get client which does not belong to him', function (done) {

        createClient(function (err, accessToken, clientID) {
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

    it('responds with HTTP code 200 and valid client infos when '
       + 'developer get client which belongs to him', function (done) {
        
        // Positive lookahead assertion - Negative lookahead assertion
        var reg = new RegExp('(?=.*client_id)'
                            +'(?=.*name)(?=.*description)'
                            +'(?=.*website)(?=.*facebook)'
                            +'(?=.*twitter)(?=.*instagram)'
                            +'(?!.*client_secret)'
                            +'(?!.*redirection_uris)(?!.*hooks)'
                            +'(?!.*"_id")'
                            +'(?!.*"__v")');

        makeARequest(200, reg, function (err, resp) {
            var body = !err && resp.body || {};

            if (err) {
                return done(err);
            }

            assert.strictEqual(Object.keys(body).length, 10);
            
            assert.ok(areValidObjectIDs([body.id]));
            assert.ok(areValidObjectIDs([body.client_id]));

            assert.ok(Type.is(body.name, String) && body.name.length > 0);
            assert.ok(Type.is(body.description, String) && body.description.length > 0);
            assert.ok(Type.is(body.website, String) && body.website.length > 0);
            
            assert.ok(Type.is(body.logo, String) 
                      && !!body.logo.match(new RegExp(
                        '^'
                        + config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS
                        + '/clients/logos/' 
                        + config.EVENID_UPLOADS.HASH.PATTERN
                        + '$'
                      )));
            
            /* Optional properties */

            assert.ok(Type.is(body.facebook_username, String));
            assert.ok(Type.is(body.twitter_username, String));
            assert.ok(Type.is(body.instagram_username, String));
            assert.ok(Type.is(body.authorize_test_accounts, Boolean));

            done();
        });
    });
});