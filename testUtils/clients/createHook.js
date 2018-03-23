var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app, createClient) {
    return function (cb) {
        var context = this;

        createClient(function (err, accessToken, clientID) {
            if (err) {
                return cb(err);
            }

            if (context.accessToken) {
                accessToken = context.accessToken;
                clientID = context.clientID;
            }

            var authHeader = 'Bearer ' + accessToken;

            request(app)
                .post('/clients/' + clientID + '/hooks')
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send({
                    url: context.url || 'http://foo.fr/' + mongoose.Types.ObjectId().toString(),
                    event_type: context.eventType || 'USER_DID_REVOKE_ACCESS'
                })
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, clientID, res.body.id);
                });
        });
    };
};