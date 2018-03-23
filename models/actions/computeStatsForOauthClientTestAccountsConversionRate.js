var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var moment = require('moment-timezone');

var async = require('async');

var config = require('../../config');

var db = require('../');

var getOauthClientTestAccounts = require('./getOauthClientTestAccounts');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);
                               
var isValidTimezone = require('../validators/isValidTimezone');

module.exports = function (clientID, period, today, timezone, cb) {
    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(period 
              && !!period.toString()
                    .match(new RegExp(config.EVENID_OAUTH
                                            .PATTERNS
                                            .USER_EVENTS_PERIOD)),
              'argument `period` is invalid');

    // Today can have changed
    // between function call and function response
    // so pass it as parameter
    assert.ok(today instanceof Date,
              'argument `date` must be an instance of Date');

    assert.ok(isValidTimezone(timezone),
              'argument `timezone` must be a valid timezone');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var periodNb = period.split(' ')[0];

    // day|month|year
    period = period.split(' ')[1].replace(/s$/, '');

    var timezoneOffset = moment.tz(today, timezone)
                               .utcOffset();

    var createdFrom = moment.tz(today, timezone)
                            .subtract(periodNb, period + 's')
                            .startOf(period)
                            .toDate();

    var project = {
        $project: {
            count: true,
            previous_count: true
        }
    };
    
    var groupByFormat = '%Y-%m-%d';
    var momentFormat = 'YYYY-MM-DD';

    // MongoDB stores dates with UTC timezone
    if (timezoneOffset >= 0) {
        project.$project.at_tz = {
            $add: ['$at', timezoneOffset * 60 * 1000]
        }
    } else if (timezoneOffset < 0) {
        project.$project.at_tz = {
            $subtract: ['$at', -timezoneOffset * 60 * 1000]
        };
    }

    if (period === 'month') {

        groupByFormat = '%Y-%m';
        momentFormat = 'YYYY-MM';

    } else if (period === 'year') {

        groupByFormat = '%Y';
        momentFormat = 'YYYY';
    }

    async.auto({
        findNbOfTestAccounts: function (cb) {
            getOauthClientTestAccounts(clientID, function (err, testAccounts) {
                if (err) {
                    return cb(err);
                }

                cb(null, testAccounts);
            });
        },

        aggregateTestAccounts: function (cb) {
            db.models.OauthClientTestAccount.aggregate(
                [
                    {
                        $match: {
                            // StackOverflow, I love you so much!
                            // http://stackoverflow.com/questions/16310598/
                            // unable-to-use-match-operator-for-mongodb-mongoose
                            // -aggregation-with-objectid
                            client: new mongoose.Types.ObjectId(clientID),
                            at: {
                                $gte: createdFrom
                            }
                        }
                    },

                    {
                        $sort: {
                            at: 1
                        }
                    },

                    project,

                    {
                        $group: {
                            _id: {
                                at: {
                                    $dateToString: {
                                        format: groupByFormat,
                                        date: '$at_tz'
                                    }
                                }
                            },

                            // For this day|month|year
                            // get the most recent count
                            count: {
                                $last: '$count'
                            },

                            // For this day|month|year
                            // get the first previous count
                            // (ie: the last count of the previous day|month|year)
                            previous_count: {
                                $first: '$previous_count'
                            },

                            last_date: {
                                $last: '$at_tz'
                            }
                        }
                    }
                ]
            ).exec(function (err, testAccounts) {
                if (err) {
                    return cb(err);
                }

                cb(null, testAccounts);
            });
        }
    }, function (err, results) {
        var createdFromFormated = null;
        var stats = {};
        var previousCount = undefined;

        var nbOfTestAccounts = results.findNbOfTestAccounts;
        var testAccounts = results.aggregateTestAccounts;

        var getConversionRate = function (obj) {
            if (obj.registered === 0) {
                return 0;
            }

            return parseFloat((obj.converted / obj.registered).toFixed(2));
        };

        if (err) {
            return cb(err);
        }

        testAccounts.forEach(function (testAccount) {
            stats[moment.tz(testAccount.last_date, timezone)
                        .format(momentFormat)] = testAccount;
        });

        // Populate stats object with all dates
        // that compose this period
        for (var i = 0; i <= periodNb; ++i) {
            // Make sure we start from today to older dates
            // given that we use previous count, not next count
            createdFromFormated = moment.tz(today, timezone)
                                        .subtract(i, period + 's')
                                        .startOf(period)
                                        .format(momentFormat);
            
            if (stats[createdFromFormated]) {
                previousCount = stats[createdFromFormated].previous_count;
                stats[createdFromFormated] = getConversionRate(stats[createdFromFormated].count);

                continue;
            }

            // Maybe set to `0`, so don't
            // check as boolean
            if (Type.is(previousCount, Object)) {
                stats[createdFromFormated] = getConversionRate(previousCount);

                continue;
            }

            stats[createdFromFormated] = getConversionRate(nbOfTestAccounts);
        }
        
        cb(null, stats);
    });
};