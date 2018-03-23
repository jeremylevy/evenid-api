var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app) {
    return function (accessToken, clientID, redirectionURIID, cb) {
        var authHeader = 'Bearer ' + accessToken;

        request(app)
            .get('/clients/' + clientID + '/redirection-uris/' + redirectionURIID)
            .set('Authorization', authHeader)
            .end(function (err, res) {
                if (err) {
                    return cb(err);
                }

                cb(null, res.body);
            });
    };
};