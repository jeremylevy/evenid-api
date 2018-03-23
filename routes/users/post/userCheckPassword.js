var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var checkScope = require('../../oauth/middlewares/checkScope');

// We break the "REST way" of the API 
// for security concerns given that user password was sent.
module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/check-password$');

    app.post(uriReg, checkScope('app'), function (req, res, next) {
        var userPassword = validator.trim(req.body.user_password);

        var user = res.locals.user;

        var userID = req.params[0];

        // User password must be checked 
        // against access token user
        if (user.id !== userID) {
            return next(new AccessDeniedError());
        }

        async.auto({
            checkUserPassword: function (cb, results) {
                user.comparePassword(userPassword, function (err, ok) {
                    if (err) {
                        return cb(err);
                    }

                    if (!ok) {
                        return cb(new InvalidRequestError({
                            user_password: userPassword 
                                ? 'Your password is invalid.'
                                : 'Your password must be set.'
                        }));
                    }

                    cb(null, ok);
                });
            }
        }, function (err, results) {
            if (err) {
                return next(err);
            }

            res.send({});
        });
    });
};