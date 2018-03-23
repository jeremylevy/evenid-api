var assert = require('assert');
var Type = require('type-of-is');

var request = require('supertest');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createOauthClient = require('../../../../testUtils/clients/create');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var createOauthUserEvent = require('../../../../testUtils/db/createOauthUserEvent');

var makeARequest = null;
var app = null;
    
describe('GET /clients/:client_id/statistics/events/today', function () {
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
                        .get('/clients/' + clientID + '/statistics/events/today')
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

                createOauthClient(cb);
            };

            getAppAccessToken = getAppAccessToken(app);
            createOauthClient = createOauthClient(app, getAppAccessToken);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        createOauthClient(function (err, accessToken, clientID) {
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

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        createOauthClient(function (err, accessToken, clientID) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                clientID: clientID
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        createOauthClient(function (err, accessToken, clientID) {
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

        createOauthClient(function (err, accessToken, clientID) {
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

    it('responds with HTTP code 403 and error when developer try to '
       + 'get client statistics which does not belong to him', function (done) {

        createOauthClient(function (err, accessToken, clientID) {
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
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-developer try to get client statistics', function (done) {

        createOauthClient(function (err, accessToken, clientID) {
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

    it('compute stats for oauth client user events', function (done) {
        var today = new Date();
        var yesterday = moment().subtract(1, 'days').toDate();

        var successReg = new RegExp('{(?=.*today)(?=.*yesterday)'
                                    + '(?=.*todayVsYesterday)'
                                    + '(?=.*registration)(?=.*login)'
                                    + '(?=.*deregistration).+}');

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient(function (err, accessToken, clientID) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, {
                        accessToken: accessToken,
                        clientID: clientID
                    });
                });
            },

            // Event used as reference to return in count
            createOauthUserEvent: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var clientID = oauthClient.clientID;

                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }],

            // Event used as reference to return in count
            createOauthUserEvent2: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var clientID = oauthClient.clientID;

                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: yesterday
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }],

            // Event used as reference to return in count
            createOauthUserEvent3: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var clientID = oauthClient.clientID;

                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'deregistration',
                    created_at: yesterday
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }],

            // Event used as reference to return in count
            createOauthTestUserEvent: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var clientID = oauthClient.clientID;

                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'test_account_registration',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }],

            // Event used as reference to return in count
            createOauthTestUserEvent2: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var clientID = oauthClient.clientID;

                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'test_account_converted',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }],

            // Make sure it takes into account period
            createOauthUserEvent4: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var clientID = oauthClient.clientID;

                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'registration',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }]
        }, function (err, results) {
            var oauthClient = results && results.createOauthClient;
            var accessToken = oauthClient && oauthClient.accessToken;
            var clientID = oauthClient && oauthClient.clientID;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                clientID: clientID
            }, 200, successReg, function (err, resp) {
                var stats = resp && resp.body;

                if (err) {
                    return done(err);
                }

                assert.strictEqual(Object.keys(stats).length, 4);

                /* Today */
                assert.strictEqual(stats.today.registration, 1);
                assert.strictEqual(stats.today.login, 1);
                assert.strictEqual(stats.today.deregistration, 0);

                assert.strictEqual(stats.today.test_account_registration, 1);
                assert.strictEqual(stats.today.test_account_converted, 1);

                /* Yesterday */
                assert.strictEqual(stats.yesterday.registration, 0);
                assert.strictEqual(stats.yesterday.login, 1);
                assert.strictEqual(stats.yesterday.deregistration, 1);

                assert.strictEqual(stats.yesterday.test_account_registration, 0);
                assert.strictEqual(stats.yesterday.test_account_converted, 0);

                /* Today vs yesterday */
                assert.strictEqual(stats.todayVsYesterday.registration, 1);
                assert.strictEqual(stats.todayVsYesterday.login, 0);
                assert.strictEqual(stats.todayVsYesterday.deregistration, -1);

                assert.strictEqual(stats.todayVsYesterday.test_account_registration, 1);
                assert.strictEqual(stats.todayVsYesterday.test_account_converted, 1);

                assert.strictEqual(stats.timezone, 'UTC');

                done();
            });
        });
    });
});