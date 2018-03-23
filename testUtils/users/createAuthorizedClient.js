var request = require('supertest');

var getOauthClientAccessToken = require('../getOauthClientAccessToken');

module.exports = function (cb) {
    getOauthClientAccessToken(function (err, resp) {
        if (err) {
            return cb(err);
        }

        cb(null, resp.appAccessToken, 
           resp.user.id, resp.client.id);
    });
};