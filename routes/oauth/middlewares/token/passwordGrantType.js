var validator = require('validator');
var async = require('async');

var config = require('../../../../config');

var db = require('../../../../models');

var MaxAttemptsError = require('../../../../errors/types/MaxAttemptsError');

var verifyRecaptcha = require('../../../../libs/verifyRecaptcha');

var countEvent = require('../../../../models/actions/countEvent');
var insertEvent = require('../../../../models/actions/insertEvent');
var removeEvents = require('../../../../models/actions/removeEvents');

var insertOauthAccessToken = require('../../../../models/actions/insertOauthAccessToken');
var insertOauthAuthorization = require('../../../../models/actions/insertOauthAuthorization');

module.exports = function (req, res, next) {
    var context = this;
    // Used in order to try to log user 
    // to determine if it is registered or not
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var resp = usedDuringOauthAuthorize ? {} : res.locals.resp;
    var sendRes = usedDuringOauthAuthorize ? function () {} : res.locals.sendRes;

    if (!resp) {
        throw new Error('`resp` must be set as response locals '
                        + 'property before calling `passwordGrantType` '
                        + 'middleware');
    }

    if (!sendRes) {
        throw new Error('`sendRes` must be set as response locals '
                        + 'property before calling `passwordGrantType` '
                        + 'middleware');
    }

    var grantType = validator.trim(req.body.grant_type);

    var username = validator.trim(req.body.username);
    var password = validator.trim(req.body.password);

    var recaptchaResponse = validator.trim(req.body['g-recaptcha-response']);

    var flow = null;

    var cleanInvalidLoginLogs = function (email, cb) {
        // `null`: IP address
        removeEvents(null, {
            email: email
        }, 'invalid_login', function (err) {
            if (err) {
                return cb(err);
            }

            cb(null);
        });
    };

    if (usedDuringOauthAuthorize) {
        username = context.email;
        password = context.password;

        flow = req.query.flow;
    }

    if (grantType !== 'password' 
        && !usedDuringOauthAuthorize) {

        return next();
    }

    async.auto({
        findEmail: function (cb) {
            db.models.Email.findOne({
                address: username
            }, function (err, email) {
                var emailNotFoundErr = new Error();

                if (err) {
                    return cb(err);
                }
                
                // Invalid email
                // During oauth authorize we need to distinguish 
                // between invalid email and invalid password 
                // error depending on the flow
                // (ie: `invalid_email` during registration 
                // means user is not registered)
                if (!email) {
                    emailNotFoundErr.name = 'invalid_email';

                    return cb(emailNotFoundErr);
                }

                return cb(null, email);
            });
        },

        findUser: ['findEmail', function (cb, results) {
            var email = results.findEmail;

            // Find user
            db.models.User.findOne({
                emails: email.id
            }, function (err, user) {
                var userNotFoundErr = new Error();

                if (err) {
                    return cb(err);
                }

                // Invalid email
                // During oauth authorize we need to distinguish 
                // between invalid email and invalid password 
                // error depending on the flow
                // (ie: `invalid_email` during registration 
                // means user is not registered)
                if (!user) {
                    userNotFoundErr.name = 'invalid_email';

                    return cb(userNotFoundErr);
                }

                cb(null, user);
            });
        }],
        
        findNbOfFailedLogin: ['findUser', function (cb, results) {
            var user = results.findUser;

            var userIPAddress = null;
            var timeout = config.EVENID_EVENTS.TIMEOUTS.INVALID_LOGIN;

            // Automatic login made after signup
            // or password recovering. Make sure we don't
            // display captcha.
            if (user.auto_login) {
                user.auto_login = false;

                user.save(function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, 0);
                });
                
                return;
            }

            countEvent(userIPAddress, {
                email: username
            }, 'invalid_login', timeout, function (err, count) {

                if (err) {
                    return cb(err);
                }

                // Too many attempts to login, brute-force?
                if (count >= config.EVENID_EVENTS.MAX_ATTEMPTS.INVALID_LOGIN) {
                    // If ReCaptcha was displayed
                    if (recaptchaResponse) {
                        
                        return verifyRecaptcha(req, function (err, success) {
                            if (err) {
                                return cb(err);
                            }

                            // Captcha is valid -> Clean all invalid login 
                            // logs in order to reset max attempts count
                            cleanInvalidLoginLogs(username, function (err) {
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
        }],

        comparePassword: ['findNbOfFailedLogin', function (cb, results) {
            var email = results.findEmail;
            var user = results.findUser;

            var nbOfFailedLogin = results.findNbOfFailedLogin;

            user.comparePassword(password, function (err, ok) {
                var invalidPasswordErr = new Error();

                if (err) {
                    return cb(err);
                }

                // Invalid password
                // During oauth authorize we need to distinguish 
                // between invalid email and invalid password 
                // error depending on the flow
                // (ie: `invalid_email` during registration 
                // means user is not registered)
                if (!ok) {
                    invalidPasswordErr.name = 'invalid_password';

                    return cb(invalidPasswordErr);
                }

                /* Valid credentials */

                resp.user_id = user.id;

                // Invalid login logs were cleaned
                // after captcha was checked
                if (nbOfFailedLogin >= config.EVENID_EVENTS.MAX_ATTEMPTS.INVALID_LOGIN
                    && recaptchaResponse) {

                    return cb(null, user);
                }

                // Clean all invalid login logs in order to reset
                // max attempts count
                cleanInvalidLoginLogs(username, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            });
        }],

        insertOauthAuthorization: ['comparePassword', function (cb, results) {
            var user = results.findUser;
            // Password grant is only used by app
            var scope = ['app'];
            var userUseTestAccount = false;
            var authorizedEntities = {};

            if (user.is_developer) {
                scope.push('app_developer');
            }

            insertOauthAuthorization(userUseTestAccount, authorizedEntities, {
                issued_for: user._id,
                type: 'password',
                scope: scope
            }, function (err, authorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, authorization);
            });
        }],

        insertOauthAccessToken: ['insertOauthAuthorization', function (cb, results) {
            var authorization = results.insertOauthAuthorization;
            var email = results.findEmail;
            var insertContext = {};

            // During oauth authorize flow,
            // we save client who have logged user
            // in order to automatically authorize
            // user if wanted scope is only email
            if (usedDuringOauthAuthorize) {
                insertContext = {
                    name: 'passwordGrantOnClient',
                    logged_by_client: context.clientID,
                    logged_with_email: email.id
                };
            }

            insertOauthAccessToken.call(insertContext, authorization, function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                // Tokens are hashed in DB, send raw values instead
                resp.access_token = accessToken._token;
                resp.refresh_token = accessToken._refresh_token;

                cb(null, accessToken);
            });
        }]
    }, function (err, results) {
        var isInvalidGrantError = (err && ['invalid_email', 'invalid_password'].indexOf(err.name) !== -1 
                                   && (!usedDuringOauthAuthorize 
                                       || err.name === 'invalid_password' 
                                       || flow === 'login'));
       
        var callback = function () {
            if (usedDuringOauthAuthorize) { // Next is a callback
                if (isInvalidGrantError) {
                    // Send the same oauth/token error 
                    // than during app login 
                    // in order to facilitate error 
                    // management for the app
                    return context.sendTokenRes({
                        error: 'invalid_grant',

                        invalid_email: err.name === 'invalid_email',
                        invalid_password: err.name === 'invalid_password'
                    }, res);
                }

                if (err) {
                    return next(err);
                }

                // Send the same access token than during app login 
                // in order to ease the process for the app
                // so call the same method `sendTokenRes`.
                // SendTokenRes returns response 
                // when called with oauth authorization context.
                return next(null, context.sendTokenRes(resp, res));
            }

            if (isInvalidGrantError) {
                resp.error = 'invalid_grant';

                resp.invalid_email = err.name === 'invalid_email';
                resp.invalid_password = err.name === 'invalid_password';

                return sendRes();
            }

            if (err) {
                return next(err);
            }

            sendRes();
        };

        if (isInvalidGrantError
            && err.name === 'invalid_password') {

            return insertEvent({
                entities: {
                    email: username
                },
                type: 'invalid_login'
            }, function (err, event) {
                if (err) {
                    return next(err);
                }

                callback();
            });
        }

        callback();
    });
};