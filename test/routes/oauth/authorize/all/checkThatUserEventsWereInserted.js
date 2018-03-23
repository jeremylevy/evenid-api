var assert = require('assert');
var request = require('supertest');

var mongoose = require('mongoose');
var querystring = require('querystring');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');
var getAppAccessToken = require('../../../../../testUtils/getAppAccessToken');

var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var findOauthUserEvents = require('../../../../../testUtils/db/findOauthUserEvents');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var unauthenticatedAccessToken = null;
var userEmail = mongoose.Types.ObjectId().toString() + '@evenid.com';

var userPassword = mongoose.Types.ObjectId().toString();
var userID = null;

describe('ALL /oauth/authorize (Check that user events were '
         + 'inserted for non client owner)', function () {
    
    before(function (done) {
        // Authorize client for user
        getOauthClientAccessToken.call({
            // Make sure user can register
            // without being logged
            redirectionURIScope: ['emails'],
            redirectionURIScopeFlags: []
        }, function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;
            
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            makeARequest = function (accessToken, flow, data, statusCode, cb) {
                var query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };
                
                request(app)
                    .post('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .set('X-Originating-IP', '127.0.0.1')
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send(data)
                    .expect(statusCode, function (err, res) {
                        var resp = null;

                        if (err) {
                            return cb(err);
                        }

                        resp = res.body;

                        cb(null, resp);
                    });
            };
            
            done();
        });
    });

    before(function (done) {
        getUnauthenticatedAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            unauthenticatedAccessToken = accessToken;

            done();
        });
    });
    
    it('inserts `registration` event', function (done) {
        makeARequest(unauthenticatedAccessToken, 'registration', {
            email: userEmail,
            password: userPassword
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            // For next test
            userID = resp.accessToken.user_id

            findOauthUserEvents({
                user: userID,
                client: client.id,
                type: 'registration'
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                done();
            });
        });
    });

    it('inserts `login` event', function (done) {
        makeARequest(unauthenticatedAccessToken, 'login', {
            email: userEmail,
            password: userPassword
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            findOauthUserEvents({
                // Taken from previous test
                user: userID,
                client: client.id,
                type: 'login'
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                done();
            });
        });
    });
});