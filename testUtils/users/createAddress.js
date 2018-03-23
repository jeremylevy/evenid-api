var request = require('supertest');

module.exports = function (app, getAppAccessToken) {
    return function (cb) {
        var context = this;

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return cb(err);
            }

            var authHeader = 'Bearer ' + accessToken;

            request(app)
                .post('/users/' + user.id + '/addresses')
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send({
                    full_name: 'John Malkovich',
                    address_line_1: '747 east streat',
                    address_line_2: 'builing 7',
                    access_code: '67837',
                    city: 'Pasadena',
                    state: 'California',
                    postal_code: '74874',
                    country: 'US',
                    address_type: 'residential'
                })
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, user.id, res.body.id, res.body.address_line_1);
                });
        });
    };
};