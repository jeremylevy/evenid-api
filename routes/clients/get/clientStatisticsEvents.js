var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var checkScope = require('../../oauth/middlewares/checkScope');
var computeStatsForOauthUserEvents = require('../../../models/actions/computeStatsForOauthUserEvents');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/statistics/events$');

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
            computeStats: function (cb) {
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
            var stats = results && results.computeStats;

            if (err) {
                return next(err);
            }

            res.send(stats);
        });
    });
};