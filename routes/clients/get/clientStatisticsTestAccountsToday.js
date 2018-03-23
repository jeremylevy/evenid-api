var async = require('async');
var moment = require('moment-timezone');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

var getCorrespondingLocaleTimezone = require('../../../libs/getCorrespondingLocaleTimezone');

var checkScope = require('../../oauth/middlewares/checkScope');

var computeStatsForOauthUserEvents = require('../../../models/actions/computeStatsForOauthUserEvents');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/statistics/test-accounts/today$');

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
            computeStats: function (cb) {
                computeStatsForOauthUserEvents(clientID, '1 day', today, 
                                               timezone,
                                               function (err, stats) {
                    
                    var today = moment.tz(today, timezone)
                                      .format('YYYY-MM-DD');

                    if (err) {
                        return cb(err);
                    }

                    // Replace date with `today` 
                    // and `yesterday`
                    // Easier to use in app view
                    Object.keys(stats).forEach(function (date) {
                        var day = 'today';

                        if (date !== today) {
                            day = 'yesterday';
                        }

                        stats[day] = stats[date];

                        delete stats[date];
                    });

                    stats['todayVsYesterday'] = {};

                    // Difference between today and yesterday
                    Object.keys(stats['today']).forEach(function (eventType) {
                        stats['todayVsYesterday'][eventType] = stats['today'][eventType] 
                                                               - stats['yesterday'][eventType];
                    });

                    cb(null, stats);
                });
            }
        }, function (err, results) {
            var stats = results && results.computeStats;

            if (err) {
                return next(err);
            }

            stats.timezone = getCorrespondingLocaleTimezone(currentLocale, timezone);

            res.send(stats);
        });
    });
};