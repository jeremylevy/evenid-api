var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var createHash = require('../../../libs/createHash');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

var checkScope = require('../../oauth/middlewares/checkScope');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/recover-password/(' 
                            + config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                    .CODE
                                    .PATTERN 
                            + ')$');
    
    app.post(uriReg, checkScope('unauthenticated_app'), 
             function (req, res, next) {
        
        var newPassword = validator.trim(req.body.password);
        // Used during oauth authorize
        var client = validator.trim(req.body.client);

        var code = req.params[0];

        var invalidLinkErr = new AccessDeniedError('The link you have followed is '
                                                   + 'invalid or expired. Please retry.');

        if (client && !areValidObjectIDs([client])) {
            return next(new AccessDeniedError());
        }

        async.auto({
            checkResetReq: function (cb) {
                var checkResetReq = db.models.UserResetPasswordRequest.findOne({
                    code: createHash(config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                           .CODE
                                           .HASHING_ALGORITHM, code)
                });

                // Populate user to use the 
                // pre save hook for password hashing.
                // Populate email to make sure used code
                // is attached to an existent email.
                checkResetReq.populate('user email');

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

            updatePasswordForUser: ['checkResetReq', function (cb, results) {
                var user = results.checkResetReq.user;

                // Pre save hook for password hashing
                user.password = newPassword;
                // User will be logged automatically.
                // Make sure captcha will not be displayed.
                user.auto_login = true;

                user.save(function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }],

            findOauthClient: ['updatePasswordForUser', function (cb, results) {
                if (!client) {
                    return cb(null);
                }

                db.models.OauthClient.findOne({
                    client_id: client
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    if (!oauthClient) {
                        return cb(new AccessDeniedError());
                    }

                    cb(null, oauthClient);
                });
            }],

            removeResetRequest: ['updatePasswordForUser', function (cb, results) {
                var resetRequest = results.checkResetReq;

                resetRequest.remove(function (err, resetRequest) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resetRequest);
                });
            }]
        }, function (err, results) {
            var resetRequest = results && results.checkResetReq;
            var oauthClient = results && results.findOauthClient;

            var user = resetRequest && resetRequest.user;
            
            var resp = {
                status: 'ok'
            };

            if (err) {
                return next(err);
            }

            if (oauthClient) {
                resp.next_flow = user.hasAuthorizedClient(oauthClient.id)
                    ? 'login' 
                    : 'registration';
            }

            res.send(resp);
        });
    });
};