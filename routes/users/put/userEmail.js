var Type = require('type-of-is');

var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/emails/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.put(uriReg, checkScope('app'), function (req, res, next) {
        var email = !Type.is(req.body.email, undefined)
                        ? validator.trim(req.body.email)
                        : undefined;

        var isMainAddress = !Type.is(req.body.is_main_address, undefined)
                                ? req.body.is_main_address === 'true'
                                : undefined;

        var password = validator.trim(req.body.password);

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
            checkUserPassword: function (cb, results) {
                user.comparePassword(password, function (err, ok) {
                    var invalidPasswordErr = new InvalidRequestError({
                        password: password 
                            ? 'Your password is invalid.'
                            : 'Your password must be set.'
                    });
                    
                    if (err) {
                        return cb(err);
                    }

                    if (!ok) {
                        if (!Type.is(email, undefined)) {
                            // Send email errors along with password error
                            (new db.models.Email({
                                address: email,
                                user: userID
                            })).validate(function (err) {
                                invalidPasswordErr.mongooseValidationErrors = (err && err.errors || {});
                                
                                return cb(invalidPasswordErr);
                            });

                            return;
                        }

                        return cb(invalidPasswordErr);
                    }

                    cb(null, ok);
                });
            },

            findEmail: ['checkUserPassword', function (cb) {
                db.models.Email.findById(emailID, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    if (!email) {
                        return cb(new NotFoundError());
                    }

                    if (email.is_main_address
                        && !Type.is(isMainAddress, undefined)
                        && !isMainAddress) {
                        
                        return cb(new InvalidRequestError({
                            is_main_address: 'You must have at least one contact address.'
                        }));
                    }

                    cb(null, email);
                });
            }],

            updateEmail: ['findEmail', function (cb, results) {
                var emailToUpdate = results.findEmail;
                var emailIsUpdated = !Type.is(email, undefined) 
                                        && emailToUpdate.address !== email;

                if (!Type.is(email, undefined)) {
                    emailToUpdate.address = email;
                }

                if (emailIsUpdated) {
                    emailToUpdate.is_verified = false;
                }

                if (!Type.is(isMainAddress, undefined)) {
                    emailToUpdate.is_main_address = isMainAddress;
                }

                emailToUpdate.save(function (err, updatedEmail) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedEmail);
                });
            }],

            // We must have only one main email address by user
            removeFlagInCurrentMainAddress: ['updateEmail', function (cb, results) {
                var updatedEmail = results.findEmail;
                
                var emails = user.toObject({
                    depopulate: true
                }).emails;
                
                var emailsID = [];

                if (Type.is(isMainAddress, undefined)
                    || !isMainAddress) {

                    return cb(null);
                }

                // Update all emails excepted the one that was updated
                emails.forEach(function (emailID) {
                    if (emailID.toString() === updatedEmail.id) {
                        return;
                    }

                    emailsID.push(emailID);
                });

                if (!emailsID.length) {
                    return cb(null, 0);
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
            }]
        }, function (err, results) {
            var updatedEmail = results && results.updateEmail;

            if (err) {
                return next(err);
            }

            res.send(updatedEmail.toObject({
                transform: true,
                // Display `id` instead of `_id`
                // see transform method
                hide: '_id __v',
                replace: [['address'], ['email']]
            }));
        });
    });
};