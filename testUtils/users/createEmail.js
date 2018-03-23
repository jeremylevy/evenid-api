var mongoose = require('mongoose');
var request = require('supertest');

module.exports = function (app, getAppAccessToken) {
    return function (cb) {
        var context = this;

        var email = mongoose.Types.ObjectId().toString() + '@evenid.com';

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return cb(err);
            }

            var authHeader = 'Bearer ' + accessToken;

            request(app)
                .post('/users/' + user.id + '/emails')
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send({
                    email: context.email || email,
                    is_main_address: context.is_main_address || 'false',
                    password: user.password
                })
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, user.id, res.body.id, res.body.email, user);
                });
        });
    };
};