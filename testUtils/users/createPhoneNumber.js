var request = require('supertest');

module.exports = function (app, getAppAccessToken) {
    return function (cb) {
        var context = this;

        getAppAccessToken(function (err, accessToken, user) {
            var authHeader = 'Bearer ';

            if (err) {
                return cb(err);
            }

            authHeader += accessToken;

            request(app)
                .post('/users/' + user.id + '/phone-numbers')
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send(context.dataToSend || {
                    phone_type: 'landline',
                    number: '0483379983',
                    country: 'FR'
                })
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, user.id, res.body.id, res.body.number);
                });
        });
    };
};