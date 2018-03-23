var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment-timezone');

var computeStatsForOauthUserEvents = require('../../../models/actions/computeStatsForOauthUserEvents');

var createOauthUserEvent = require('../../../testUtils/db/createOauthUserEvent');
var removeOauthUserEventCollection = require('../../../testUtils/db/removeOauthUserEventCollection');

var testTimezone = function (today, timezone, expectedToday, expectedPreviousDay, done) {
    var clientID = mongoose.Types.ObjectId();
    var userID = mongoose.Types.ObjectId();

    async.auto({
        // Event used as reference to return in count
        createOauthUserEvent: function (cb) {
            createOauthUserEvent({
                user: userID,
                client: clientID,
                type: 'login',
                created_at: today
            }, function (err, oauthUserEvent) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserEvent);
            });
        },

        computeStatsForOauthUserEventsForDay: ['createOauthUserEvent', 
                                                function (cb, results) {
                        
            computeStatsForOauthUserEvents(clientID, '1 day', 
                                           today, timezone, function (err, stats) {
                if (err) {
                    return cb(err);
                }

                cb(null, stats);
            });
        }]
    }, function (err, results) {
        var statsForDay = results && results.computeStatsForOauthUserEventsForDay;

        var thisDay = moment.tz(today, timezone)
                            .format('YYYY-MM-DD');

        var previousDay = moment.tz(today, timezone)
                            .subtract(1, 'days')
                            .format('YYYY-MM-DD');

        if (err) {
            return done(err);
        }
        
        assert.strictEqual(thisDay, expectedToday);
        assert.strictEqual(previousDay, expectedPreviousDay);

        assert.strictEqual(Object.keys(statsForDay).length, 2);

        assert.strictEqual(statsForDay[thisDay].registration, 0);
        assert.strictEqual(statsForDay[thisDay].login, 1);
        assert.strictEqual(statsForDay[thisDay].deregistration, 0);

        assert.strictEqual(statsForDay[thisDay].test_account_registration, 0);
        assert.strictEqual(statsForDay[thisDay].test_account_converted, 0);
        
        assert.strictEqual(statsForDay[previousDay].registration, 0);
        assert.strictEqual(statsForDay[previousDay].login, 0);
        assert.strictEqual(statsForDay[previousDay].deregistration, 0);

        assert.strictEqual(statsForDay[previousDay].test_account_registration, 0);
        assert.strictEqual(statsForDay[previousDay].test_account_converted, 0);

        done();
    });
};

describe('models.actions.computeStatsForOauthUserEvents', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `computeStatsForOauthUserEvents`
            // query is based on date
            // make sure `OauthUserEvent` collection is empty
            removeOauthUserEventCollection(function (err) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });

    it('throws an exception when passing non-ObjectID as client ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                computeStatsForOauthUserEvents(
                    v, 
                    '1 day',
                    new Date(), 
                    'Europe/Paris', 
                    function () {}
                );
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid period', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                computeStatsForOauthUserEvents(
                    mongoose.Types.ObjectId(), 
                    v,
                    new Date(), 
                    'Europe/Paris', 
                    function () {}
                );
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid date as today', function () {
        [null, undefined, {}, 9, [], 'bar', new Object()].forEach(function (v) {
            assert.throws(function () {
                computeStatsForOauthUserEvents(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    v, 
                    'Europe/Paris', 
                    function () {}
                );
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid timezone', function () {
        [null, undefined, {}, 9, [], 'bar', new Object()].forEach(function (v) {
            assert.throws(function () {
                computeStatsForOauthUserEvents(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    new Date(), 
                    v, 
                    function () {}
                );
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                computeStatsForOauthUserEvents(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    new Date(),
                    'Europe/Paris',  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('compute stats for oauth client user events', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        // MongoDB stores date as UTC.
        // Use a fixed date to not be 
        // fooled when subtracting days or months.
        var today = moment.utc('16-03-2015', 'DD-MM-YYYY').toDate();

        async.auto({
            // Event used as reference
            // to return in count
            createOauthUserEvent: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            // Event used as reference
            // to return in count
            createOauthUserEvent2: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'registration',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            // Event used as reference
            // to return in count
            createOauthUserEvent3: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'deregistration',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            // Event used as reference
            // to return in count
            createOauthTestUserEvent: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'test_account_registration',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            // Event used as reference
            // to return in count
            createOauthTestUserEvent2: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'test_account_converted',
                    created_at: moment.utc(today)
                                .subtract(2, 'months')
                                .toDate()
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            // Make sure it takes
            // into account period
            createOauthUserEvent4: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'deregistration',
                    created_at: moment.utc(today)
                                .subtract(2, 'months')
                                .toDate()
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            // Make sure it takes 
            // into account period
            createOauthUserEvent5: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'registration',
                    created_at: moment.utc(today)
                                .subtract(1, 'months')
                                .toDate()
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Make sure client ID 
            // is taken into account
            createOauthUserEvent6: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: mongoose.Types.ObjectId(),
                    type: 'login',
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            computeStatsForOauthUserEventsForDay: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                   'createOauthUserEvent3', 'createOauthUserEvent4',
                                                   'createOauthUserEvent5', 'createOauthUserEvent6',
                                                   'createOauthTestUserEvent', 'createOauthTestUserEvent2',
                                                  function (cb, results) {
                            
                computeStatsForOauthUserEvents(clientID, '1 day', 
                                              today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthUserEventsForMonth: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                    'createOauthUserEvent3', 'createOauthUserEvent4',
                                                    'createOauthUserEvent5', 'createOauthUserEvent6',
                                                    'createOauthTestUserEvent', 'createOauthTestUserEvent2',
                                                    function (cb, results) {
                            
                computeStatsForOauthUserEvents(clientID, '1 month', 
                                              today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthUserEventsForYear: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                   'createOauthUserEvent3', 'createOauthUserEvent4',
                                                   'createOauthUserEvent5', 'createOauthUserEvent6',
                                                   'createOauthTestUserEvent', 'createOauthTestUserEvent2',
                                                   function (cb, results) {
                            
                computeStatsForOauthUserEvents(clientID, '1 year', 
                                              today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }]
        }, function (err, results) {
            var statsForDay = results && results.computeStatsForOauthUserEventsForDay;
            var statsForMonth = results && results.computeStatsForOauthUserEventsForMonth;
            var statsForYear = results && results.computeStatsForOauthUserEventsForYear;

            var thisDay = moment.utc(today).format('YYYY-MM-DD');
            var previousDay = moment.utc(today)
                                .subtract(1, 'days')
                                .format('YYYY-MM-DD');
            
            var thisMonth = moment.utc(today).format('YYYY-MM');
            var previousMonth = moment(today)
                                    .subtract(1, 'months')
                                    .format('YYYY-MM');

            var thisYear = moment.utc(today).format('YYYY');
            var previousYear = moment.utc(today)
                                .subtract(1, 'years')
                                .format('YYYY');

            if (err) {
                return done(err);
            }

            assert.strictEqual(Object.keys(statsForDay).length, 2);
            assert.strictEqual(Object.keys(statsForMonth).length, 2);
            assert.strictEqual(Object.keys(statsForYear).length, 2);
            
            /* This day */
            assert.strictEqual(statsForDay[thisDay].registration, 1);
            assert.strictEqual(statsForDay[thisDay].login, 1);
            assert.strictEqual(statsForDay[thisDay].deregistration, 1);

            assert.strictEqual(statsForDay[thisDay].test_account_registration, 1);
            assert.strictEqual(statsForDay[thisDay].test_account_converted, 0);

            /* Previous day */
            assert.strictEqual(statsForDay[previousDay].registration, 0);
            assert.strictEqual(statsForDay[previousDay].login, 0);
            assert.strictEqual(statsForDay[previousDay].deregistration, 0);

            assert.strictEqual(statsForDay[previousDay].test_account_registration, 0);
            assert.strictEqual(statsForDay[previousDay].test_account_converted, 0);
            
            /* This month */
            assert.strictEqual(statsForMonth[thisMonth].registration, 1);
            assert.strictEqual(statsForMonth[thisMonth].login, 1);
            assert.strictEqual(statsForMonth[thisMonth].deregistration, 1);

            assert.strictEqual(statsForMonth[thisMonth].test_account_registration, 1);
            assert.strictEqual(statsForMonth[thisMonth].test_account_converted, 0);

            /* Previous month */ 
            assert.strictEqual(statsForMonth[previousMonth].registration, 1);
            assert.strictEqual(statsForMonth[previousMonth].login, 0);
            assert.strictEqual(statsForMonth[previousMonth].deregistration, 0);

            assert.strictEqual(statsForMonth[previousMonth].test_account_registration, 0);
            assert.strictEqual(statsForMonth[previousMonth].test_account_converted, 0);

            /* This year */
            assert.strictEqual(statsForYear[thisYear].registration, 2);
            assert.strictEqual(statsForYear[thisYear].login, 1);
            assert.strictEqual(statsForYear[thisYear].deregistration, 2);

            assert.strictEqual(statsForYear[thisYear].test_account_registration, 1);
            assert.strictEqual(statsForYear[thisYear].test_account_converted, 1);

            /* Previous year */
            assert.strictEqual(statsForYear[previousYear].registration, 0);
            assert.strictEqual(statsForYear[previousYear].login, 0);
            assert.strictEqual(statsForYear[previousYear].deregistration, 0);

            assert.strictEqual(statsForYear[previousYear].test_account_registration, 0);
            assert.strictEqual(statsForYear[previousYear].test_account_converted, 0);

            done();
        });
    });
    
    it('compute stats while respecting > UTC timezone', function (done) {
        // We want to check that this event
        // will be assigned to `17-03-2015`
        var today = moment.utc('16-03-2015 22:00:00', 
                               'DD-MM-YYYY HH:mm:ss').toDate();
        // UTC +12
        var timezone = 'Asia/Anadyr';

        var expectedToday = '2015-03-17';
        var expectedPreviousDay = '2015-03-16';

        testTimezone(today, timezone, expectedToday, expectedPreviousDay, done);
    });
    
    it('compute stats while respecting < UTC timezone', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        // We want to check that this event
        // will be assigned to `15-03-2015`
        var today = moment.utc('16-03-2015 04:00:00', 
                               'DD-MM-YYYY HH:mm:ss').toDate();
        // UTC -8
        var timezone = 'America/Los_Angeles';

        var expectedToday = '2015-03-15';
        var expectedPreviousDay = '2015-03-14';

        testTimezone(today, timezone, expectedToday, expectedPreviousDay, done);
    });
});