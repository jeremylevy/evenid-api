var assert = require('assert');
var Type = require('type-of-is');

var request = require('supertest');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var createRedirectionURI = require('../../../../testUtils/clients/createRedirectionURI');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;
    
describe('GET /clients/:client_id/redirection-uris', function () {
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
                             + '/redirection-uris')
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
                clientID: clientID
            }, 400, /invalid_request/, done);
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
                clientID: clientID
            }, 400, /invalid_token/, done);
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
                    clientID: clientID
                }, 400, /expired_token/, done);
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
                    clientID: clientID
                }, 400, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to get client redirection URIs', function (done) {

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
                    clientID: clientID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to get client redirection URIs which does not belong to him', function (done) {

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
                    clientID: clientID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 200 and valid redirection URIs infos when '
       + 'developer get client redirection URIs which belongs to him', function (done) {
        
        // Positive lookahead assertion 
        // - Negative lookahead assertion
        var reg = new RegExp(
            '(?=.*id)(?=.*uri)'
            + '(?=.*response_type)(?=.*scope)'
            + '(?!.*"_id")(?!.*"__v")'
        );
        
        makeARequest(200, reg, function (err, resp) {
            var redirectionURIs = resp.body;

            if (err) {
                return done(err);
            }

            assert.ok(Type.is(redirectionURIs, Array) 
                      && redirectionURIs.length > 0);
            
            redirectionURIs.forEach(function (redirectionURI) {
                assert.strictEqual(Object.keys(redirectionURI).length, 7);

                assert.ok(areValidObjectIDs([redirectionURI.id]));
                assert.ok(areValidObjectIDs([redirectionURI.client]));

                assert.ok(Type.is(redirectionURI.uri, String) 
                          && redirectionURI.uri.length > 0);

                assert.ok(Type.is(redirectionURI.response_type, String) 
                          && redirectionURI.response_type.length > 0);

                assert.ok(Type.is(redirectionURI.scope, Array) 
                          && redirectionURI.scope.length > 0);

                // May be empty
                assert.ok(Type.is(redirectionURI.scope_flags, Array));

                assert.ok(Type.is(redirectionURI.needs_client_secret, Boolean));
            });

            done();
        });
    });
});