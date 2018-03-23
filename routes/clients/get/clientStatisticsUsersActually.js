var async = require('async');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

var getCorrespondingLocaleTimezone = require('../../../libs/getCorrespondingLocaleTimezone');

var checkScope = require('../../oauth/middlewares/checkScope');

var getOauthClientRegisteredUsers = require('../../../models/actions/getOauthClientRegisteredUsers');
var getOauthClientActiveUsers = require('../../../models/actions/getOauthClientActiveUsers');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/statistics/users/actually$');

    app.get(uriReg, checkScope('app_developer'), function (req, res, next) {
        var clientID = req.params[0];

        var currentLocale = req.i18n.getLocale();
        var user = res.locals.user;

        var today = new Date();
        var timezone = user.timezone || 'UTC';

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findNbOfRegisteredUsers: function (cb) {
                getOauthClientRegisteredUsers(clientID, function (err, registeredUsers) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUsers);
                });
            },

            findNbOfActiveUsers: function (cb) {
                getOauthClientActiveUsers(clientID, '1 month', today, timezone, function (err, activeUsers) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, activeUsers);
                });
            }
        }, function (err, results) {
            var registeredUsers = results && results.findNbOfRegisteredUsers;
            var activeUsers = results && results.findNbOfActiveUsers;

            var stats = {};

            if (err) {
                return next(err);
            }

            stats = {
                registeredUsers: registeredUsers,
                activeUsers: activeUsers,
                // Avoid division by zero
                retention: parseFloat((activeUsers / Math.max(registeredUsers, 1)).toFixed(2)),
                timezone: getCorrespondingLocaleTimezone(currentLocale, timezone)
            };

            res.send(stats);
        });
    });
};