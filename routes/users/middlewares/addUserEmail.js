var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

module.exports = function (req, res, next) {
    var context = this;
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var email = validator.trim(req.body.email);
    var password = validator.trim(req.body.password);
    var isMainAddress = validator.trim(req.body.is_main_address) === 'true';

    var user = res.locals.user;
    var userID = !usedDuringOauthAuthorize && req.params[0];
    
    var emailToInsert = {
        user: user.id,
        address: email,
        is_main_address: isMainAddress
    };

    // Check that user is access token user
    if (!usedDuringOauthAuthorize 
        && user.id !== userID) {

        return next(new AccessDeniedError());
    }

    if (user.emails.length >= config.EVENID_USERS.MAX_ENTITIES.EMAILS) {
        return next(new AccessDeniedError('You have reached the maximum number '
                                        + 'of emails allowed per user.'));
    }

    async.auto({
        checkUserPassword: function (cb, results) {
            user.comparePassword(password, function (err, ok) {
                if (err) {
                    return cb(err);
                }

                if (!ok) {
                    // Send email errors along with password error
                    (new db.models.Email(emailToInsert)).validate(function (err) {
                        return cb(new InvalidRequestError({
                            password: password 
                                ? 'Your password is invalid.' 
                                : 'Your password must be set.'
                        }, err && err.errors || {}));
                    });

                    return;
                }

                cb(null, ok);
            });
        },

        addEmail: ['checkUserPassword', function (cb) {
            db.models.Email.create(emailToInsert, function (err, email) {
                if (err) {
                    return cb(err);
                }

                cb(null, email);
            });
        }],

        // We must have only one 
        // main email address by user
        // Set this BEFORE attaching email to user
        removeFlagInCurrentMainAddress: ['addEmail', function (cb, results) {
            var emailsID = user.toObject({
                // Make sure `emails` array 
                // is an array of IDs
                depopulate: true
            }).emails;

            if (!isMainAddress) {
                return cb(null);
            }

            db.models.Email.update({
                _id: {
                    $in: emailsID
                },

                is_main_address: true
            }, {
                is_main_address: false
            }, {
                // We may update many emails
                multi: emailsID.length > 1
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        attachEmailToUser: ['removeFlagInCurrentMainAddress', function (cb, results) {
            var email = results.addEmail;

            user.emails.push(email._id);

            // Make sure user will be saved
            // event if emails array is populated
            user.markModified('emails');

            user.save(function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        }]
    }, function (err, results) {
        var email = results && results.addEmail;

        if (err) {
            return next(err);
        }

        if (usedDuringOauthAuthorize) {
            return next(null, email);
        }

        res.send(email.toObject());
    });
};