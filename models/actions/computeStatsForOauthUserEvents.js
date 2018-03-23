var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var moment = require('moment-timezone');

var config = require('../../config');

var db = require('../');

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
            type: true
        }
    };
    
    var groupByFormat = '%Y-%m-%d';
    var momentFormat = 'YYYY-MM-DD';

    // MongoDB stores dates with UTC timezone
    if (timezoneOffset >= 0) {
        project.$project.created_at_tz = {
            $add: ['$created_at', timezoneOffset * 60 * 1000]
        }
    } else if (timezoneOffset < 0) {
        project.$project.created_at_tz = {
            $subtract: ['$created_at', -timezoneOffset * 60 * 1000]
        };
    }

    if (period === 'month') {

        groupByFormat = '%Y-%m';
        momentFormat = 'YYYY-MM';

    } else if (period === 'year') {

        groupByFormat = '%Y';
        momentFormat = 'YYYY';
    }

    db.models.OauthUserEvent.aggregate(
        [
            {
                $match: {
                    // StackOverflow, I love you so much!
                    // http://stackoverflow.com/questions/16310598/
                    // unable-to-use-match-operator-for-mongodb-mongoose
                    // -aggregation-with-objectid
                    client: new mongoose.Types.ObjectId(clientID),
                    created_at: {
                        $gte: createdFrom
                    }
                }
            },

            project,

            {
                $group: {
                    _id: {
                        type: '$type',
                        created_at: {
                            $dateToString: {
                                format: groupByFormat,
                                date: '$created_at_tz'
                            }
                        }
                    },

                    count: {
                        $sum: 1
                    }
                }
            }
       ]
    ).exec(function (err, events) {
        var createdFromFormated = null;
        var stats = {};

        if (err) {
            return cb(err);
        }

        // Populate stats object with all dates
        // that compose this period
        for (var i = 0; i <= periodNb; ++i) {
            createdFromFormated = moment.tz(today, timezone)
                                    .subtract(i, period + 's')
                                    .startOf(period)
                                    .format(momentFormat);

            stats[createdFromFormated] = {};
        }

        // Set all event types to `0`
        // for all dates that compose 
        // this period
        Object.keys(stats).forEach(function (date) {
            config.EVENID_OAUTH
                  .VALID_EVENT_TYPES_FOR_USER
                  .forEach(function (eventType) {

                stats[date][eventType] = 0;
            });
        });

        // Replace `0` by value if any
        events.forEach(function (event) {
            stats[event._id.created_at][event._id.type] = event.count;
        });

        cb(null, stats);
    });
};