var request = require('supertest');
var async = require('async');

var config = require('../config');

module.exports = function (app) {
    return function (cb) {
        var self = this;

        async.auto({
            getAccessToken: function (cb) {
                request(app)
                    .post('/oauth/token')
                    .set('Authorization', config.EVENID_APP.AUTHORIZATION_HTTP_HEADER)
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send({
                        grant_type: 'client_credentials'
                    })
                    .end(function (err, res) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, res.body);
                    });
            }
        }, function (err, results) {
            var getAccessTokenResp = results && results.getAccessToken;

            if (err) {
                return cb(err);
            }

            cb(null, getAccessTokenResp.access_token,
               getAccessTokenResp.refresh_token);
        });
    };
};