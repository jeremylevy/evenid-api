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
var authenticatedAccessToken = null;

var unauthenticatedUserID = null;

var unauthenticatedUserEmail = mongoose.Types.ObjectId().toString() + '@evenid.com';
var unauthenticatedUserPassword = mongoose.Types.ObjectId().toString();

var authenticatedUser = null;

describe('ALL /oauth/authorize (Check that test user events were '
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

    before(function (done) {
        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            authenticatedAccessToken = accessToken;
            authenticatedUser = user;

            done();
        });
    });
    
    it('inserts `test_account_registration` '
       + 'event for unauthenticated users', function (done) {
        
        makeARequest(unauthenticatedAccessToken, 'registration', {
            use_test_account: 'true'
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }
            
            // For next test
            unauthenticatedUserID = resp.userID;

            findOauthUserEvents({
                user: unauthenticatedUserID,
                client: client.id
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                assert.strictEqual(oauthUserEvents[0].type, 'test_account_registration');

                done();
            });
        });
    });

    it('doesn\'t insert `test_account_registration` '
       + 'event twice for same unauthenticated user', function (done) {

        makeARequest(unauthenticatedAccessToken, 'registration', {
            use_test_account: 'true',
            test_account: unauthenticatedUserID
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            findOauthUserEvents({
                // Taken from previous test
                user: unauthenticatedUserID,
                client: client.id
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                assert.strictEqual(oauthUserEvents[0].type, 'test_account_registration');

                done();
            });
        });
    });

    it('inserts `test_account_converted` '
       + 'event for unauthenticated users '
       + 'which register after testing', function (done) {
        
        makeARequest(unauthenticatedAccessToken, 'registration', {
            email: unauthenticatedUserEmail,
            password: unauthenticatedUserPassword,
            test_account: unauthenticatedUserID
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            findOauthUserEvents({
                user: unauthenticatedUserID,
                client: client.id,
                type: 'test_account_converted'
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                done();
            });
        });
    });

    it('inserts `test_account_registration` '
       + 'event for authenticated users', function (done) {
        
        makeARequest(authenticatedAccessToken, 'registration', {
            use_test_account: 'true'
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            findOauthUserEvents({
                user: authenticatedUser.id,
                client: client.id
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                assert.strictEqual(oauthUserEvents[0].type, 'test_account_registration');

                done();
            });
        });
    });

    it('doesn\'t insert `test_account_registration` '
       + 'event twice for same authenticated user', function (done) {

        makeARequest(authenticatedAccessToken, 'registration', {
            use_test_account: 'true'
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }

            findOauthUserEvents({
                user: authenticatedUser.id,
                client: client.id
            }, function (err, oauthUserEvents) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserEvents.length, 1);

                assert.strictEqual(oauthUserEvents[0].type, 'test_account_registration');

                done();
            });
        });
    });

    it('inserts `test_account_converted` '
       + 'event for authenticated users '
       + 'which register after testing', function (done) {

        makeARequest(authenticatedAccessToken, 'registration', {
            email: authenticatedUser.emails[0].id
        }, 200, function (err, resp) {
            if (err) {
                return done(err);
            }
            
            findOauthUserEvents({
                user: authenticatedUser.id,
                client: client.id,
                type: 'test_account_converted'
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