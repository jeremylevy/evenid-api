var Type = require('type-of-is');
var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app) {
    return function (accessToken, clientID, redirectionURIID, update, cb) {
        var authHeader = 'Bearer ' + accessToken;

        if (Type.is(update.scope, Array)) {
            update.scope = update.scope.join(' ');
        }

        if (Type.is(update.scope_flags, Array)) {
            update.scope_flags = update.scope_flags.join(' ');
        }
        
        request(app)
            .put('/clients/' + clientID + '/redirection-uris/' + redirectionURIID)
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