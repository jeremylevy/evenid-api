var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var checkScope = require('../../oauth/middlewares/checkScope');

var computeStatsForOauthClientRegisteredUsers = require('../../../models/actions/computeStatsForOauthClientRegisteredUsers');
var computeStatsForOauthClientActiveUsers = require('../../../models/actions/computeStatsForOauthClientActiveUsers');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/statistics/users$');

    app.get(uriReg, checkScope('app_developer'), function (req, res, next) {
        var period = validator.trim(req.query.period);
        var clientID = req.params[0];

        var user = res.locals.user;
        
        var today = new Date();
        var timezone = user.timezone || 'UTC';

        if (!period.match(new RegExp(config.EVENID_OAUTH
                                           .PATTERNS
                                           .USER_EVENTS_PERIOD))) {
            
            return next(new InvalidRequestError({
                period: 'period parameter is invalid.'
            }));
        }

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            computeRegisteredUserStats: function (cb) {
                computeStatsForOauthClientRegisteredUsers(clientID, period, 
                                                          today, timezone,
                                                          function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            },

            computeActiveUserStats: function (cb) {
                computeStatsForOauthClientActiveUsers(clientID, period,
                                                      today, timezone,
                                                      function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }
        }, function (err, results) {
            var registeredUsers = results && results.computeRegisteredUserStats;
            var activeUsers = results && results.computeActiveUserStats;

            var stats = {};

            if (err) {
                return next(err);
            }

            // We may also use `activeUsers`
            // keys given that stats are for
            // the same period
            Object.keys(registeredUsers).forEach(function (date) {
                var retention = 0;

                if (activeUsers[date] > 0
                    && registeredUsers[date] > 0) {

                    retention = parseFloat((activeUsers[date] / registeredUsers[date]).toFixed(2));
                }

                stats[date] = {
                    registered_users: registeredUsers[date],
                    active_users: activeUsers[date],
                    retention: retention
                };
            });

            res.send(stats);
        });
    });
};