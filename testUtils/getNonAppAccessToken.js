var async = require('async');
var request = require('supertest');

var getOauthClientAccessToken = require('./getOauthClientAccessToken');

module.exports = function (app) {
    return function (cb) {
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return cb(err);
            }

            cb(null, resp.accessToken, resp);
        });
    };
};