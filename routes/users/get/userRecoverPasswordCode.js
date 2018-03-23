var async = require('async');

var config = require('../../../config');

var db = require('../../../models');

var createHash = require('../../../libs/createHash');

var validateEmail = require('../../../models/actions/validateEmail');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/recover-password/(' 
                            + config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                    .CODE
                                    .PATTERN 
                            + ')$');
    
    app.get(uriReg, checkScope('unauthenticated_app'), 
            function (req, res, next) {
        
        var code = req.params[0];

        var invalidLinkErr = new AccessDeniedError('The link you have followed is '
                                                   + 'invalid or expired. Please retry.');

        async.auto({
            checkResetReq: function (cb) {
                var checkResetReq = db.models.UserResetPasswordRequest.findOne({
                    code: createHash(config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                           .CODE
                                           .HASHING_ALGORITHM, code)
                });

                // Populate email 
                // in order to send it
                checkResetReq.populate('email');

                checkResetReq.exec(function (err, request) {
                    if (err) {
                        return cb(err);
                    }

                    if (!request) {
                        return cb(invalidLinkErr);
                    }

                    if (!request.email 
                        || request.expires_at <= new Date()) {
                        
                        request.remove(function (err, removedRequest) {
                            cb(invalidLinkErr);
                        });

                        return;
                    }

                    cb(null, request);
                });
            },

            // Given that we have sent an 
            // email containing a link to user 
            // and that user clicked on it, 
            // we may consider that it equals to
            // email validation.
            validateEmail: ['checkResetReq', function (cb, results) {
                var email = results.checkResetReq.email;

                if (email.is_verified) {
                    return cb(null, email);
                }
                
                validateEmail(email.id, function (err, updatedEmail) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedEmail);
                });
            }]
        }, function (err, results) {
            var resetRequest = results && results.checkResetReq;

            if (err) {
                return next(err);
            }

            // Used to display email 
            // along with new password field
            res.send({
                email: resetRequest.email.address
            });
        });
    });
};