var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createClient = require('../../../../testUtils/clients/create');
var findOauthClients = require('../../../../testUtils/db/findOauthClients');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

describe('DELETE /clients/:client_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;

            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, clientID, user) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    if (user) {
                        data.user_password = user.password;
                    }

                    request(app)
                        .delete('/clients/' + clientID)
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

        createClient(function (err, accessToken, clientID, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                clientID: clientID
            }, 400, {
                user_password: user.password
            }, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createClient(function (err, accessToken, clientID, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                clientID: clientID
            }, 400, {
                user_password: user.password
            }, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {

        createClient(function (err, accessToken, clientID, user) {
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
                }, 400, {
                    user_password: user.password
                }, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        createClient(function (err, accessToken, clientID, user) {
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
                }, 400, {
                    user_password: user.password
                }, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to delete client', function (done) {

        createClient(function (err, accessToken, clientID, user) {
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
                }, 403, {
                    user_password: user.password
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'developer try to delete client which does not belong to him', function (done) {

        createClient(function (err, accessToken, clientID, user) {
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
                }, 403, {
                    user_password: user.password
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'developer password is invalid', function (done) {

        createClient(function (err, accessToken, clientID, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                clientID: clientID
            }, 400, {
                user_password: mongoose.Types.ObjectId().toString()
            }, /(?=.*error)(?=.*user_password)/, done);
        });
    });

    it('responds with HTTP code 200 and empty JSON object when '
       + 'developer delete client which belongs to him', function (done) {

        async.auto({
            createClient: function (cb) {
                createClient(function (err, accessToken, clientID, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID,
                        user: user
                    });
                });
            },

            assertClientWasCreated: ['createClient', function (cb, results) {
                var createClientResp = results.createClient;
                var clientID = createClientResp.clientID;
                
                findOauthClients([clientID], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    cb();
                });
            }],

            deleteClient: ['assertClientWasCreated', function (cb, results) {
                var createClientResp = results.createClient;
                var clientID = createClientResp.clientID;
                var accessToken = createClientResp.accessToken;
                var user = createClientResp.user;

                makeARequest.call({
                    accessToken: accessToken,
                    clientID: clientID
                }, 200, {
                    user_password: user.password
                }, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertClientWasDeleted: ['deleteClient', function (cb, results) {
                var createClientResp = results.createClient;
                var clientID = createClientResp.clientID;

                findOauthClients([clientID], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 0);

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