var assert = require('assert');
var request = require('supertest');

var mongoose = require('mongoose');
var querystring = require('querystring');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var assertRegisteredUsersNb = require('../../../../../testUtils/validators/assertOauthClientRegisteredUsersNb');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var unauthenticatedAccessToken = null;

var userEmail = mongoose.Types.ObjectId().toString() + '@evenid.com';
var userPassword = mongoose.Types.ObjectId().toString();

describe('ALL /oauth/authorize (Check that client registered '
         + 'users are updated for non client owner)', function () {
    
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
    
    it('updates during `registration` event', function (done) {
        makeARequest(unauthenticatedAccessToken, 'registration', {
            email: userEmail,
            password: userPassword
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertRegisteredUsersNb(client.id, 1, done);
        });
    });

    it('doesn\'t update during `login` event', function (done) {
        makeARequest(unauthenticatedAccessToken, 'login', {
            email: userEmail,
            password: userPassword
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertRegisteredUsersNb(client.id, 1, done);
        });
    });
});