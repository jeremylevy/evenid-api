var request = require('supertest');

var config = require('../../config');

var userRecoverPasswordEmailMock = require('../mocks/routes/users/post/userRecoverPassword');

module.exports = function (app, getAppAccessToken) {
    return function (cb) {
        getAppAccessToken(function (err, accessToken, user, refreshToken, 
                                    unauthAccessTok, unauthRefreshTok) {
            
            var recoverPasswordCode = 'TEST_VALID_CODE';
            var emailLink = config.EVENID_APP.ENDPOINT 
                                + '/recover-password/' 
                                + recoverPasswordCode;

            if (err) {
                return cb(err);
            }

            userRecoverPasswordEmailMock([config.EVENID_APP.NAME,
                                            emailLink, 
                                            emailLink, 
                                            config.EVENID_APP.NAME],
                                         config.EVENID_APP.NAME,
                                         config.EVENID_APP.LOGO, 
                                         emailLink,
                                         user.email);

            request(app)
                .post('/users/recover-password')
                .set('Authorization', 'Bearer ' + unauthAccessTok)
                // Body parser middleware needs 
                // it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .send({
                    email: user.email
                })
                .end(function (err, res) {
                    var request = res && res.body;

                    if (err) {
                        return cb(err);
                    }

                    request.accessToken = unauthAccessTok;
                    request.user = user;

                    cb(null, request);
                });
        });
    };
};