var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment-timezone');

var computeStatsForOauthClientActiveUsers = require('../../../models/actions/computeStatsForOauthClientActiveUsers');

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

        computeStatsForOauthClientActiveUsersForDay: ['createOauthUserEvent', 
                                                     function (cb, results) {
                        
            computeStatsForOauthClientActiveUsers(clientID, '1 day', 
                                                 today, timezone, function (err, stats) {
                if (err) {
                    return cb(err);
                }

                cb(null, stats);
            });
        }]
    }, function (err, results) {
        var statsForDay = results && results.computeStatsForOauthClientActiveUsersForDay;

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

        assert.strictEqual(statsForDay[thisDay], 1);
        assert.strictEqual(statsForDay[previousDay], 0);

        done();
    });
};

describe('models.actions.computeStatsForOauthClientActiveUsers', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `computeStatsForOauthClientActiveUsers`
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
                computeStatsForOauthClientActiveUsers(
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
                computeStatsForOauthClientActiveUsers(
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
                computeStatsForOauthClientActiveUsers(
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
                computeStatsForOauthClientActiveUsers(
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
                computeStatsForOauthClientActiveUsers(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    new Date(),
                    'Europe/Paris',  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('compute stats for oauth client active users', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        // MongoDB stores date as UTC.
        // Use a fixed date to not be 
        // fooled when subtracting days or months.
        var today = moment.utc('16-03-2015', 'DD-MM-YYYY').toDate();

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

            // Event used as reference to return in count
            createOauthUserEvent2: function (cb) {
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

            // Make sure it doesnt count 
            // same user multiple times
            createOauthUserEvent3: function (cb) {
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

            // Make sure it doesnt count 
            // same user multiple times
            createOauthUserEvent4: function (cb) {
                createOauthUserEvent({
                    user: userID,
                    client: clientID,
                    type: 'login',
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

            // Created in order to check that 
            // `computeStatsForOauthClientActiveUsers`
            // takes into account event type
            createOauthUserEvent5: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'registration',
                    created_at: today
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Created in order to check that 
            // `computeStatsForOauthClientActiveUsers`
            // takes into account period
            createOauthUserEvent6: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: moment.utc(today)
                                .subtract(1, 'years')
                                .toDate()
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Created in order to check that 
            // `computeStatsForOauthClientActiveUsers`
            // takes into account period
            createOauthUserEvent7: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: moment.utc(today)
                                .subtract(1, 'month')
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
            createOauthUserEvent8: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: mongoose.Types.ObjectId(),
                    type: 'login',
                    created_at: moment.utc(today)
                                .subtract(8, 'months')
                                .toDate()
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            computeStatsForOauthClientActiveUsersForDay: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                         'createOauthUserEvent3', 'createOauthUserEvent4',
                                                         'createOauthUserEvent5', 'createOauthUserEvent6',
                                                         'createOauthUserEvent7', 'createOauthUserEvent8',
                                                         function (cb, results) {
                            
                computeStatsForOauthClientActiveUsers(clientID, '1 day', 
                                                     today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthClientActiveUsersForMonth: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                           'createOauthUserEvent3', 'createOauthUserEvent4',
                                                           'createOauthUserEvent5', 'createOauthUserEvent6',
                                                           'createOauthUserEvent7', 'createOauthUserEvent8',
                                                           function (cb, results) {
                            
                computeStatsForOauthClientActiveUsers(clientID, '1 month', 
                                                     today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthClientActiveUsersForYear: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                          'createOauthUserEvent3', 'createOauthUserEvent4',
                                                          'createOauthUserEvent5', 'createOauthUserEvent6',
                                                          'createOauthUserEvent7', 'createOauthUserEvent8',
                                                          function (cb, results) {
                            
                computeStatsForOauthClientActiveUsers(clientID, '1 year', 
                                                     today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }]
        }, function (err, results) {
            var statsForDay = results && results.computeStatsForOauthClientActiveUsersForDay;
            var statsForMonth = results && results.computeStatsForOauthClientActiveUsersForMonth;
            var statsForYear = results && results.computeStatsForOauthClientActiveUsersForYear;

            var thisDay = moment.utc(today).format('YYYY-MM-DD');
            var previousDay = moment.utc(today)
                                .subtract(1, 'days')
                                .format('YYYY-MM-DD');
            
            var thisMonth = moment.utc(today).format('YYYY-MM');
            var previousMonth = moment.utc(today)
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

            assert.strictEqual(statsForDay[thisDay], 2);
            assert.strictEqual(statsForDay[previousDay], 0);
            
            assert.strictEqual(statsForMonth[thisMonth], 2);
            assert.strictEqual(statsForMonth[previousMonth], 1);

            assert.strictEqual(statsForYear[thisYear], 3);
            assert.strictEqual(statsForYear[previousYear], 1);

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
        var expectedPreviousDay = '2015-03-16'

        testTimezone(today, timezone, expectedToday, expectedPreviousDay, done);
    });
    
    it('compute stats while respecting < UTC timezone', function (done) {
        // We want to check that this event
        // will be assigned to `15-03-2015`
        var today = moment.utc('16-03-2015 04:00:00', 
                               'DD-MM-YYYY HH:mm:ss').toDate();
        // UTC -8
        var timezone = 'America/Los_Angeles';

        var expectedToday = '2015-03-15';
        var expectedPreviousDay = '2015-03-14'

        testTimezone(today, timezone, expectedToday, expectedPreviousDay, done);
    });
});