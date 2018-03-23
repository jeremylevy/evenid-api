var assert = require('assert');
var Type = require('type-of-is');

var request = require('supertest');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createOauthClient = require('../../../../testUtils/clients/create');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

var testRoute = function (period, done) {
    createOauthClient(function (err, accessToken, clientID) {
        if (err) {
            return done(err);
        }
        
        makeARequest.call({
            accessToken: accessToken,
            clientID: clientID,
            period: period
        }, 200, /{(?=.*registered_users)(?=.*active_users)(?=.*retention).+}/, done);
    });
};
    
describe('GET /clients/:client_id/statistics/users', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, clientID, period) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;
                    var qs = '?period=' + (period || '1 day');

                    request(app)
                        .get('/clients/' + clientID + '/statistics/users' + qs)
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
                    return cb(null, this.accessToken, this.clientID, this.period);
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

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid period parameter', function (done) {

        createOauthClient(function (err, accessToken, clientID) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: accessToken,
                clientID: clientID,
                period: 'bar'
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 200 and stats '
       + 'for day period parameter', function (done) {

        testRoute('6 days', done);
    });

    it('responds with HTTP code 200 and stats '
       + 'for month period parameter', function (done) {

        testRoute('11 months', done);
    });

    it('responds with HTTP code 200 and stats '
       + 'for year period parameter', function (done) {

        testRoute('6 years', done);
    });
});