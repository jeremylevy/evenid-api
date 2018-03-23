var querystring = require('querystring');
var async = require('async');

var mongoose = require('mongoose');
var request = require('supertest');

var getOauthClientAccessToken = require('./getOauthClientAccessToken');
var GetUnauthenticatedAppAccessToken = require('./getUnauthenticatedAppAccessToken');

module.exports = function (done) {
    var app = null;
    var getUnauthenticatedAppAccessToken = null;
    
    async.auto({
        // We cannot use this user 
        // given its the client owner
        getOauthClientAccessToken: function (cb) {
            getOauthClientAccessToken.call({
                // Make sure user can register
                // without being logged
                redirectionURIScope: ['emails'],
                redirectionURIScopeFlags: []
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                app = resp.app;

                getUnauthenticatedAppAccessToken = GetUnauthenticatedAppAccessToken(app);

                cb(null, resp);
            });
        },

        // Used to authorize the second client
        getUnauthenticatedAppAccessToken: ['getOauthClientAccessToken', function (cb) {
            getUnauthenticatedAppAccessToken(function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                cb(null, accessToken);
            });
        }],

        // Authorize the second user 
        // that will trigger the Oauth user event
        authorizeAnotherUser: ['getUnauthenticatedAppAccessToken',
                               function (cb, results) {
            
            var getOauthClientAccessTokenResp = results.getOauthClientAccessToken;
            var unauthenticatedAppAccessToken = results.getUnauthenticatedAppAccessToken;

            var client = getOauthClientAccessTokenResp.client;
            var redirectionURI = getOauthClientAccessTokenResp.redirectionURI;

            var query = {
                client_id: client.client_id.toString(),
                redirect_uri: redirectionURI.uri,
                state: 'foo',
                flow: 'registration'
            };
            
            request(app)
                .post('/oauth/authorize?' + querystring.stringify(query))
                .set('Authorization', 'Bearer ' + unauthenticatedAppAccessToken)
                .set('X-Originating-IP', '127.0.0.1')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                    email: mongoose.Types.ObjectId().toString() + '@evenid.com',
                    password: mongoose.Types.ObjectId().toString()
                })
                .end(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp.body);
                });
        }]
    }, function (err, results) {
        if (err) {
            return done(err);
        }

        done(null, results);
    });
};