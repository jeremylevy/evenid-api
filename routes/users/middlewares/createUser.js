var assert = require('assert');
var net = require('net');

var async = require('async');
var validator = require('validator');
var mongoose = require('mongoose');

var config = require('../../../config');

var db = require('../../../models');

var verifyRecaptcha = require('../../../libs/verifyRecaptcha');

var countEvent = require('../../../models/actions/countEvent');
var insertEvent = require('../../../models/actions/insertEvent');
var removeEvents = require('../../../models/actions/removeEvents');

var isValidationError = require('../../../models/validators/isValidationError');
var isUniqueIndexError = require('../../../models/validators/isUniqueIndexError');

var MaxAttemptsError = require('../../../errors/types/MaxAttemptsError');

var IPHeaderMissingError = require('../../../errors/types/IPHeaderMissingError');
var IPHeaderInvalidError = require('../../../errors/types/IPHeaderInvalidError');

var isValidTimezone = require('../../../models/validators/isValidTimezone');

module.exports = function (req, res, next) {
    var context = this;
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var email = validator.trim(req.body.email);
    var password = validator.trim(req.body.password);
    var isDeveloper = req.body.is_developer === 'true';

    var timezone = validator.trim(req.body.timezone);

    var recaptchaResponse = validator.trim(req.body['g-recaptcha-response']);
    var userIPAddress = validator.trim(req.get('x-originating-ip'));

    var useTestAccount = false;
    var testAccount = null;

    var cleanUserCreatedLogs = function (IP, cb) {
        removeEvents(IP, null, 'user_created', function (err) {
            if (err) {
                return cb(err);
            }

            cb(null);
        });
    };

    if (!userIPAddress) {
        return next(new IPHeaderMissingError());
    }

    if (net.isIP(userIPAddress) === 0) {
        return next(new IPHeaderInvalidError());
    }

    if (usedDuringOauthAuthorize) {
        email = context.email;
        password = context.password;

        timezone = context.timezone;

        isDeveloper = false;
        useTestAccount = context.useTestAccount;

        testAccount = context.testAccount;
    }

    // Not chosen by user during signup.
    // Build from frontend JS
    // and set in an hidden input.
    if (!isValidTimezone(timezone)) {
        timezone = undefined;
    }

    async.auto({
        findNbOfSignupForIP: function (cb) {
            countEvent(userIPAddress, null, 'user_created', 
                       config.EVENID_EVENTS
                             .TIMEOUTS
                             .USER_CREATED, function (err, count) {

                if (err) {
                    return cb(err);
                }

                // Too many attempts to signup, spam?
                if (count >= config.EVENID_EVENTS
                                   .MAX_ATTEMPTS
                                   .USER_CREATED) {
                    
                    // If ReCaptcha was displayed
                    if (recaptchaResponse) {
                        // Verify it
                        return verifyRecaptcha(req, function (err, success) {
                            if (err) {
                                return cb(err);
                            }

                            // Captcha is valid -> Clean all 
                            // `user_created` logs for this IP
                            // in order to reset max attempts count
                            cleanUserCreatedLogs(userIPAddress, function (err) {
                                if (err) {
                                    return cb(err);
                                }

                                cb(null, count);
                            });
                        });
                    }

                    return cb(new MaxAttemptsError());
                }

                cb(null, count);
            });
        },

        createEmail: ['findNbOfSignupForIP', function (cb, results) {
            if (useTestAccount) {
                return cb(null);
            }

            db.models.Email.create({
                // At this time, we don't have user so mock it
                user: mongoose.Types.ObjectId(),
                address: email,
                is_main_address: true
            }, function (emailErr, email) {
                if (emailErr) {
                    // Email is invalid.
                    // Check password validity in order to
                    // send password error alongs email error
                    if (isValidationError(emailErr)
                        && emailErr.errors.address
                        || isUniqueIndexError(emailErr)) {

                        new db.models.User({
                            password: password
                        }).validate(function (userErr) {
                            if (isValidationError(userErr)
                                && userErr.errors.password) {

                                // When Mongoose raise an `Unique Index Error`
                                // returned error doesn't contain `errors` hash
                                if (!emailErr.errors) {
                                    emailErr.errors = {};
                                    emailErr.errors.uniqueError = emailErr;
                                }
                            
                                emailErr.errors.password = userErr.errors.password;
                            }

                            // Return first error
                            cb(emailErr);
                        });

                        return;
                    }

                    return cb(emailErr);
                }

                return cb(null, email);
            });
        }],

        createUser: ['createEmail', function (cb, results) {
            var nbOfSignupForIP = results.findNbOfSignupForIP;
            var email = results.createEmail;
            var user = {
                is_test_account: useTestAccount
            };
            var callback = function (err, user) {
                if (err) {
                    return cb(err);
                }

                if (!useTestAccount) {
                    // We can update `user` property now
                    // because user was created
                    email.user = user.id;

                    email.save(function (err, updatedEmail) {
                        if (err) {
                            return cb(err);
                        }

                        // Populate emails in order to allow returning
                        // gravatar and email property
                        user.populate('emails', function (err, user) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, user);
                        });
                    });

                    return;
                }

                cb(null, user);
            };

            // User register after testing
            // Test account was checked in `lookupTestAccount`
            // middleware
            if (!useTestAccount && testAccount) {
                testAccount.emails = [email.id];
                testAccount.password = password;
                
                testAccount.timezone = timezone;
                
                testAccount.is_developer = isDeveloper;
                testAccount.is_test_account = false;

                return testAccount.save(callback);
            
            } else if (!useTestAccount) { // User register normally
                user = {
                    emails: [email.id],
                    password: password,
                    timezone: timezone,
                    is_developer: isDeveloper
                };
            } // else... user wants to test using test account for the first time

            db.models.User.create(user, callback);
        }],

        insertEvent: ['createUser', function (cb, results) {
            insertEvent({
                ip_address: userIPAddress,
                type: 'user_created'
            }, function (err, event) {
                if (err) {
                    return cb(err);
                }

                cb(null, event);
            });
        }]
    }, function (err, results) {
        var user = results && results.createUser;

        if (err) {
            return next(err);
        }

        // `next` was mocked
        if (usedDuringOauthAuthorize) {
            return next(null, user);
        }

        res.send(user.toObject());
    });
};