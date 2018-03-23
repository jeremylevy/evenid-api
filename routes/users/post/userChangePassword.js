var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/change-password$');
    
    app.post(uriReg, checkScope('app'), function (req, res, next) {
        var currentPassword = validator.trim(req.body.current_password);
        var newPassword = validator.trim(req.body.new_password);

        var userID = req.params[0];

        var user = res.locals.user;

        // We must change password 
        // of access token user
        if (user.id !== userID) {
            return next(new AccessDeniedError());
        }

        async.auto({
            checkCurrentPassword: function (cb, results) {
                user.comparePassword(currentPassword, function (err, ok) {
                    if (err) {
                        return cb(err);
                    }

                    if (!ok) {
                        return cb(new InvalidRequestError({
                            current_password: 'Your current password is invalid.'
                        }));
                    }

                    cb(null, ok);
                });
            },

            updatePasswordForUser: ['checkCurrentPassword', function (cb, results) {
                // Pre save hook for password hashing
                user.password = newPassword;

                user.save(function (err, updatedUser) {
                    if (err) {
                        // Switch error key 
                        // from `password` to `new_password`
                        // to match passed parameter names
                        if (err.name === 'ValidationError' 
                            && err.errors.password) {
                            
                            err.errors.new_password = err.errors.password;
                            err.errors.new_password.path = 'new_password';

                            delete err.errors.password;
                        }

                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }]
        }, function (err, results) {
            if (err) {
                return next(err);
            }

            res.send({});
        });
    });
};