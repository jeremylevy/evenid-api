var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app) {
    return function (accessToken, userID, emailID, update, cb) {
        var authHeader = 'Bearer ' + accessToken;

        request(app)
            .put('/users/' + userID + '/emails/' + emailID)
            // Body parser middleware needs it to populate `req.body`
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .set('Authorization', authHeader)
            .send(update)
            .end(function (err, res) {
                if (err) {
                    return cb(err);
                }

                cb(null, res.body);
            });
    };
};