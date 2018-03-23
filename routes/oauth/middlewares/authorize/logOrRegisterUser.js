var async = require('async');
var validator = require('validator');
var Type = require('type-of-is');

var findUserToSetInResponseLocals = require('../../../../models/actions/findUserToSetInResponseLocals');

var AccessDeniedError = require('../../../../errors/types/AccessDeniedError');

var logUser = require('./logUser');
var createUser = require('../../../users/middlewares/createUser');

module.exports = function (req, res, next) {
    var client = res.locals.client;

    var useTestAccount = res.locals.useTestAccount;
    // Test account is optional so don't check for its existence
    var testAccount = res.locals.testAccount;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `logOrRegisterUser` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `logOrRegisterUser` '
                        + 'middleware');
    }

    var email = validator.trim(req.body.email);
    var password = validator.trim(req.body.password);

    var timezone = validator.trim(req.body.timezone);

    async.auto({
        // Try to log user to see 
        // if it was registered
        tryToLogUser: function (cb, results) {
            if (useTestAccount) {
                return cb(null);
            }

            logUser(req, res, function (err, isLogged) {
                if (err 
                    // If email is invalid
                    // user is not registered so create it 
                    // in next callback
                    && err.name !== 'invalid_email') {

                    return cb(err);
                }

                cb(null, isLogged);
            });
        },

        // Create user if 
        // we have not been able to log him
        orCreateUser: ['tryToLogUser', function (cb, results) {
            var userWasLogged = results.tryToLogUser;

            // User is registered
            // we don't need to create it
            if (userWasLogged) {
                return cb(null);
            }

            // User has already used testing so test account
            // was already created, pass.
            if (useTestAccount 
                && testAccount) {

                return cb(null, testAccount);
            }

            /* `invalid_email` error or user wants
                to use test account for the first time */

            createUser.call({
                name: 'oauthAuthorize',
                email: email,
                password: password,
                timezone: timezone,
                useTestAccount: useTestAccount,
                // if (!useTestAccount && testAccount)
                // -> User register after testing
                // -> update test account
                testAccount: testAccount
            }, req, res, function (err, user) {
                if (err) {
                    return cb(err);
                }

                // Used to informs the app that test 
                // account cookie must be deleted
                if (!useTestAccount && testAccount) {
                    res.locals.testAccountWasMergedWithUser = true;
                }

                cb(null, user);
            });
        }],

        // Get access token using password grant type
        // in order to log user
        getAccessToken: ['orCreateUser', function (cb, results) {
            var userWasLogged = results.tryToLogUser;
            var user = results.orCreateUser;

            // Access token was set during password grant
            if (userWasLogged) {
                return cb(null);
            }

            // Test accounts are not "loggable"
            if (useTestAccount) {
                return cb(null);
            }

            logUser(req, res, function (err, isLogged) {
                if (err) {
                    return cb(err);
                }

                cb(null, isLogged);
            });
        }]
    }, function (err, results) {
        var user = results && results.orCreateUser;

        if (err) {
            return next(err);
        }

        // Given that test account are not "loggable",
        // the user locale variable (used by next middlewares)
        // is not set by log user middleware
        // so set it now
        if (useTestAccount) {
            findUserToSetInResponseLocals(user.id, function (err, user) {
                if (err) {
                    return next(err);
                }

                res.locals.user = user;

                next();
            });

            return;
        }

        next();
    });
};