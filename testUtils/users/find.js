var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app) {
    return function (accessToken, userID, cb) {
        var authHeader = 'Bearer ' + accessToken;

        request(app)
            .get('/users/' + userID)
            .set('Authorization', authHeader)
            .end(function (err, res) {
                if (err) {
                    return cb(err);
                }
                
                // `res.body.user`: When access token is app access token
                // `res.body`: When access token is client access token
                cb(null, res.body.user || res.body);
            });
    };
};