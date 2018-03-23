var request = require('supertest');

var config = require('../../config');

var createEmail = require('./createEmail');

var userEmailValidateMock = require('../mocks/routes/users/post/userEmailValidate');

module.exports = function (app, getAppAccessToken) {
    return function (cb) {
        createEmail(app, getAppAccessToken)
                   (function (err, accessToken, userID, emailID, email) {
            
            var authHeader = 'Bearer ';

            var validateEmailCode = 'TEST_VALID_CODE';
            var emailLink = null;

            if (err) {
                return cb(err);
            }

            emailLink = config.EVENID_APP.ENDPOINT 
                            + '/users/' 
                            + userID
                            + '/emails/' 
                            + emailID
                            + '/validate/' 
                            + validateEmailCode;

            userEmailValidateMock([email, emailLink, emailLink, config.EVENID_APP.NAME],
                                  config.EVENID_APP.NAME,
                                  config.EVENID_APP.LOGO, 
                                  emailLink,
                                  email);

            authHeader += accessToken;

            request(app)
                .post('/users/' + userID + '/emails/' + emailID + '/validate')
                // Body parser middleware needs it to populate `req.body`
                .set('Content-Type', 'application/x-www-form-urlencoded')
                .set('Authorization', authHeader)
                .send({
                    email: email
                })
                .end(function (err, res) {
                    var request = res && res.body;

                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, userID, emailID, request);
                });
        });
    };
};