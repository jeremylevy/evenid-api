var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app, createClient) {
    return function (cb) {
        createClient(function (err, accessToken, clientID) {
            if (err) {
                return cb(err);
            }

            var authHeader = 'Bearer ' + accessToken;

            request(app)
                .post('/clients/' + clientID + '/redirection-uris')
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send({
                    // Set `uri` to `https` to enable this uri 
                    // for code and token response type
                    uri: 'https://foo.fr/' + mongoose.Types.ObjectId().toString(),
                    response_type: 'code',
                    scope: 'emails'
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