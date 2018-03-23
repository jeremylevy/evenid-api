var async = require('async');

var config = require('../../../config');

var db = require('../../../models');

var createHash = require('../../../libs/createHash');

var checkScope = require('../../oauth/middlewares/checkScope');

var validateEmail = require('../../../models/actions/validateEmail');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/emails/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/validate/('
                            + config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                                    .CODE
                                    .PATTERN
                            + ')$');

    app.post(uriReg, checkScope('app'), function (req, res, next) {
        var userID = req.params[0];
        var emailID = req.params[1];
        var code = req.params[2];

        var user = res.locals.user;

        var invalidLinkErr = new AccessDeniedError('The link you have followed is '
                                                   + 'invalid or expired. Please retry.');

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own email
            || !user.ownEmail(emailID)) {
            
            return next(new AccessDeniedError());
        }

        async.auto({
            checkValidationReq: function (cb) {
                var checkValidationReq = db.models.UserValidateEmailRequest.findOne({
                    code: createHash(config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                                           .CODE
                                           .HASHING_ALGORITHM, code)
                });

                // Populate to make sure email exists
                checkValidationReq.populate('email');

                checkValidationReq.exec(function (err, request) {
                    if (err) {
                        return cb(err);
                    }

                    if (!request) {
                        return cb(invalidLinkErr);
                    }

                    if (!request.email
                        || request.email.is_verified
                        || request.expires_at <= new Date()) {
                        
                        request.remove(function (err, removedRequest) {
                            cb(invalidLinkErr);
                        });

                        return;
                    }

                    cb(null, request);
                });
            },

            validateEmail: ['checkValidationReq', function (cb, results) {
                var email = results.checkValidationReq.email;
                
                validateEmail(email.id, function (err, updatedEmail) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedEmail);
                });
            }],

            removeValidationRequest: ['validateEmail', function (cb, results) {
                var validationRequest = results.checkValidationReq;

                validationRequest.remove(function (err, validationRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, validationRequest);
                });
            }]
        }, function (err, results) {
            var validationRequest = results && results.checkValidationReq;

            if (err) {
                return next(err);
            }

            res.send(validationRequest.email.toObject({
                transform: true,
                // Display `id` instead of `_id`
                // see transform method
                hide: '_id __v _oauth_entities_id _granted_authorizations',
                replace: [['address'], ['email']]
            }));
        });
    });
};