var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var findUserAuthorizations = require('../../../models/actions/findUserAuthorizations');
var removeEmails = require('../../../models/actions/removeEmails');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/emails/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];
        var emailID = req.params[1];

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own email
            || !user.ownEmail(emailID)) {

            return next(new AccessDeniedError());
        }

        async.auto({
            findUserAuthorizations: function (cb) {
                findUserAuthorizations('emails', 
                                        emailID, 
                                        user._id, 
                                        function (err, authorizations) {
                    if (err) {
                        return cb(err);
                    }

                    if (authorizations.length > 0) {
                        return cb(
                            new AccessDeniedError('You must unsubscribe from all applications that '
                                                  + 'use this email before deleting it.')
                        );
                    }

                    cb(null, authorizations);
                });
            },

            findEmail: ['findUserAuthorizations', function (cb, results) {
                var query = db.models.Email.findById(emailID, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    if (!email) {
                        return cb(new NotFoundError());
                    }

                    if (email.is_main_address) {
                        return cb(new AccessDeniedError());
                    }

                    cb(null, email);
                });
            }],

            deleteEmail: ['findEmail', function (cb, results) {
                var email = results.findEmail;

                removeEmails([email._id], user._id, function (err, updatedUser) {
                    cb(err);
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