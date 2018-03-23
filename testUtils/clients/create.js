var request = require('supertest');

module.exports = function (app, getAppAccessToken) {
    return function (cb) {
        getAppAccessToken(function (err, accessToken, user) {
            var authHeader = 'Bearer ' + accessToken;

            if (err) {
                return cb(err);
            }

            request(app)
                .post('/clients')
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send({
                    name: 'foo',
                    description: 'Foo is awesome', 
                    logo: '034e38fcafd01c52242d406625d9d33eaea35263',
                    website: 'http://foo.fr',
                    authorize_test_accounts: 'true'
                })
                .end(function (err, res) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, res.body.id, user);
                });
        });
    };
};