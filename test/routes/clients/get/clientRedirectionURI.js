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
    
describe('GET /clients/:client_id/redirection-uris/:redirection_uri_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, clientID, redirectionURIID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/clients/' + clientID 
                             + '/redirection-uris/' 
                             + (this.wrongRedirectionURIID || redirectionURIID))
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
                clientID: clientID,
                redirectionURIID: redirectionURIID
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
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
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
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
                }, 400, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to get client redirection URI', function (done) {

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
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to get client redirection URI which does not belong to him', function (done) {

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
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 404 and `not_found` error error when '
       + 'attempt to modify client redirection URI which does not exist', function (done) {

        makeARequest.call({
            wrongRedirectionURIID: '507c7f79bcf86cd7994f6c0e'
        }, 404, /not_found/, done);
    });

    it('responds with HTTP code 200 and valid redirection URI infos when '
       + 'developer get client redirection URI which belongs to him', function (done) {
        
        // Positive lookahead assertion - Negative lookahead assertion
        var reg = new RegExp('(?=.*id)(?=.*uri)(?=.*client)'
                             + '(?=.*response_type)(?=.*scope)'
                             + '(?=.*scope_flags)(?=.*needs_client_secret)'
                             + '(?!.*"_id")(?!.*"__v")');
        
        makeARequest(200, reg, function (err, resp) {
            var body = !err && resp.body || {};

            if (err) {
                return done(err);
            }

            assert.strictEqual(Object.keys(body).length, 7);
            
            assert.ok(areValidObjectIDs([body.id]));
            assert.ok(areValidObjectIDs([body.client]));

            assert.ok(Type.is(body.uri, String) 
                      && body.uri.length > 0);

            assert.ok(Type.is(body.response_type, String) 
                      && body.response_type.length > 0);

            assert.ok(Type.is(body.scope, Array) 
                      && body.scope.length > 0);

            // May be empty
            assert.ok(Type.is(body.scope_flags, Array));

            assert.ok(Type.is(body.needs_client_secret, Boolean));

            done();
        });
    });
});