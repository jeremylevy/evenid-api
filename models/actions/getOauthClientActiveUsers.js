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

    var createdFrom = moment.tz(today, timezone)
                        .subtract(periodNb, period + 's')
                        .toDate();

    db.models.OauthUserEvent.aggregate(
        [
            {
                $match: {
                    // StackOverflow, I love you so much!
                    // http://stackoverflow.com/questions/16310598/
                    // unable-to-use-match-operator-for-mongodb-mongoose
                    // -aggregation-with-objectid
                    client: new mongoose.Types.ObjectId(clientID),
                    type: 'login',
                    created_at: {
                        $gte: createdFrom
                    }
                }
            },

            // Remove duplicates
            // (Users which have logged many 
            // times during the period)
            {
                $group: {
                    _id: {
                        user: '$user'
                    },
                }
            },

            // Count the number of unique users
            // which have logged during this period
            {
                $group: {
                    _id: null,

                    count: {
                        $sum: 1
                    }
                }
            }
        ]
    ).exec(function (err, events) {
        if (err) {
            return cb(err);
        }

        cb(null, events.length ? events[0].count : 0);
    });
};