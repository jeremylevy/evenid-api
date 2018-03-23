var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');

var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var findOauthUserEvents = require('../../../../../testUtils/db/findOauthUserEvents');

var makeARequest = null;
var app = null;

var user = null;

var client = null;
var redirectionURI = null;

var accessToken = null;

describe('ALL /oauth/authorize (Check that user events were '
         + 'not inserted for client owner)', function () {
    
    before(function (done) {
        // Authorize client for user
        getOauthClientAccessToken.call({
            // Make sure we don't need to send 
            // shipping and billing address
            // on login
            redirectionURIScopeFlags: []
        }, function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;
            
            accessToken = resp.appAccessToken;
            user = resp.user;
            
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            makeARequest = function (flow, data, statusCode, cb) {
                var query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };
                
                request(app)
                    .post('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
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
    
    it('doesn\'t insert `registration` event', function (done) {
        findOauthUserEvents({
            user: user.id,
            client: client.id,
            type: 'registration'
        }, function (err, oauthUserEvents) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(oauthUserEvents.length, 0);

            done();
        });
    });

    it('doesn\'t insert `login` event', function (done) {
        makeARequest('login', {}, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            findOauthUserEvents({
                user: user.id,
                client: client.id,
                type: 'login'
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 0);

                done();
            });
        });
    });
});