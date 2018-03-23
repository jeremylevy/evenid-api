var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var computeStatsForOauthClientTestAccountsConversionRate = require('../../../models/actions/computeStatsForOauthClientTestAccountsConversionRate');
var computeStatsForOauthUserEvents = require('../../../models/actions/computeStatsForOauthUserEvents');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/statistics/test-accounts$');

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
            computeTestAccountsConversionStats: function (cb) {
                computeStatsForOauthClientTestAccountsConversionRate(clientID, period, 
                                                                     today, timezone,
                                                                     function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            },

            computeRegisteredTestAccountsStats: function (cb) {
                computeStatsForOauthUserEvents(clientID, period, 
                                               today, timezone,
                                               function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }
        }, function (err, results) {
            var testAccountsConversion = results && results.computeTestAccountsConversionStats
            var registeredTestAccounts = results && results.computeRegisteredTestAccountsStats;

            var stats = {};

            if (err) {
                return next(err);
            }

            // We may also use `registeredTestAccounts`
            // keys given that stats are for
            // the same period
            Object.keys(testAccountsConversion).forEach(function (date) {
                stats[date] = {
                    registered: registeredTestAccounts[date].test_account_registration,
                    conversion: testAccountsConversion[date]
                };
            });

            res.send(stats);
        });
    });
};