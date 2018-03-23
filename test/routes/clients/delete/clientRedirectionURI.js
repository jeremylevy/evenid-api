var request = require('supertest');
var assert = require('assert');

var async = require('async');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var createRedirectionURI = require('../../../../testUtils/clients/createRedirectionURI');

var findOauthRedirectionURIs = require('../../../../testUtils/db/findOauthRedirectionURIs');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;
    
describe('DELETE /clients/:client_id/redirection-uris/:redirection_uri_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, clientID, redirectionURIID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .delete('/clients/' + clientID 
                                + '/redirection-uris/' 
                                + (this.wrongRedirectionURIID || redirectionURIID))
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
            }, 400, {}, /invalid_request/, done);
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
            }, 400, {}, /invalid_token/, done);
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
                }, 400, {}, /expired_token/, done);
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
                }, 400, {}, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to delete client redirection URI', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to delete redirection URI for client '
       + 'which does not belong to him', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 404 and `not_found` error error when attempt to '
       + 'delete client redirection URI which does not exist', function (done) {

        makeARequest.call({
            wrongRedirectionURIID: '507c7f79bcf86cd7994f6c0e'
        }, 404, {}, /not_found/, done);
    });

    it('responds with HTTP code 200 when '
       + 'deleting valid redirection URI', function (done) {
        
        async.auto({
            createRedirectionURI: function (cb) {
                createRedirectionURI(function (err, accessToken, clientID, redirectionURIID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        redirectionURIID: redirectionURIID
                    });
                });
            },

            assertRedirectionURIWasCreated: ['createRedirectionURI', function (cb, results) {
                var createRedirectionURIResp = results.createRedirectionURI;
                var redirectionURIID = createRedirectionURIResp.redirectionURIID;
                
                findOauthRedirectionURIs([redirectionURIID], function (err, redirectionURIs) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(redirectionURIs.length, 1);

                    cb();
                });
            }],

            deleteRedirectionURI: ['assertRedirectionURIWasCreated', function (cb, results) {
                var createRedirectionURIResp = results.createRedirectionURI;
                var clientID = createRedirectionURIResp.clientID;
                var accessToken = createRedirectionURIResp.accessToken;
                var redirectionURIID = createRedirectionURIResp.redirectionURIID;

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID,
                    redirectionURIID: redirectionURIID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertRedirectionURIWasDeleted: ['deleteRedirectionURI', function (cb, results) {
                var createRedirectionURIResp = results.createRedirectionURI;
                var redirectionURIID = createRedirectionURIResp.redirectionURIID;

                findOauthRedirectionURIs([redirectionURIID], function (err, redirectionURIs) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(redirectionURIs.length, 0);

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