var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');
var request = require('supertest');

var config = require('../config');

var db = require('../models');

var GetUnauthenticatedAppAccessToken = require('./getUnauthenticatedAppAccessToken');

module.exports = function (app) {
    var getUnauthenticatedAppAccessToken = GetUnauthenticatedAppAccessToken(app);

    return function (cb) {
        var self = this;
        
        var userEmail = mongoose.Types.ObjectId().toString() + '@evenid.com';
        var userPassword = 'foobar';

        async.auto({
            getUnauthenticatedAppAccessToken: function (cb, results) {
                getUnauthenticatedAppAccessToken(function (err, accessToken, refreshToken) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        refreshToken: refreshToken
                    });
                });
            },

            signupUser: ['getUnauthenticatedAppAccessToken', function (cb, results) {
                var accessToken = results.getUnauthenticatedAppAccessToken
                                         .accessToken;

                request(app)
                    .post('/users')
                    .set('Authorization', 'Bearer ' + accessToken)
                    .set('X-Originating-Ip', '127.0.0.1')
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send({
                        email: userEmail,
                        password: userPassword,
                        is_developer: !Type.is(self.isDev, undefined)
                            ? self.isDev 
                                ? 'true' 
                                : 'false'
                            : 'true'
                    })
                    .end(function (err, res) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, res.body);
                    });
            }],

            getAccessToken: ['signupUser', function (cb, results) {
                request(app)
                    .post('/oauth/token')
                    .set('Authorization', config.EVENID_APP.AUTHORIZATION_HTTP_HEADER)
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send({
                        grant_type: 'password',
                        username: userEmail,
                        password: userPassword
                    })
                    .end(function (err, res) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, res.body);
                    });
            }]
        }, function (err, results) {
            var unauthToken = results.getUnauthenticatedAppAccessToken;
            var getAccessTokenResp = results.getAccessToken;
            var user = results.signupUser;

            if (err) {
                return cb(err);
            }

            // Used when testing for login
            // during oauth authorize flow
            user.password = userPassword;

            cb(null, getAccessTokenResp.access_token,
               user, getAccessTokenResp.refresh_token,
               unauthToken.accessToken,
               unauthToken.refreshToken);
        });
    };
};