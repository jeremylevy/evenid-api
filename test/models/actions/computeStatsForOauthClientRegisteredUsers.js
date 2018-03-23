var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment-timezone');

var computeStatsForOauthClientRegisteredUsers = require('../../../models/actions/computeStatsForOauthClientRegisteredUsers');

var createOauthClientRegisteredUserLog = require('../../../testUtils/db/createOauthClientRegisteredUserLog');
var createOauthClient = require('../../../testUtils/db/createOauthClient');

var removeOauthUserEventCollection = require('../../../testUtils/db/removeOauthUserEventCollection');

var testTimezone = function (today, timezone, expectedToday, 
                             expectedPreviousDay, done) {
    
    var clientID = null;

    async.auto({
        createOauthClient: function (cb) {
            createOauthClient.call({
                statistics: {
                    // Needs to match the last count
                    registered_users: 1
                }
            }, function (err, oauthClient) {
                if (err) {
                    return cb(err);
                }

                clientID = oauthClient.id;

                cb(null, oauthClient);
            });
        },

        // Used as reference to return in count
        createOauthClientRegisteredUserLog: ['createOauthClient', function (cb, results) {
            createOauthClientRegisteredUserLog({
                client: clientID,
                count: 1,
                previous_count: 0,
                at: today
            }, function (err, registeredUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, registeredUser);
            });
        }],

        computeStatsForOauthClientRegisteredUsersForDay: ['createOauthClientRegisteredUserLog', 
                                                         function (cb, results) {
               
            computeStatsForOauthClientRegisteredUsers(clientID, '1 day', 
                                                     today, timezone, function (err, stats) {
                if (err) {
                    return cb(err);
                }

                cb(null, stats);
            });
        }],
    }, function (err, results) {
        var statsForDay = results && results.computeStatsForOauthClientRegisteredUsersForDay;

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

describe('models.actions.computeStatsForOauthClientRegisteredUsers', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `computeStatsForOauthClientRegisteredUsers` 
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
                computeStatsForOauthClientRegisteredUsers(
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
                computeStatsForOauthClientRegisteredUsers(
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
                computeStatsForOauthClientRegisteredUsers(
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
                computeStatsForOauthClientRegisteredUsers(
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
                computeStatsForOauthClientRegisteredUsers(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    new Date(),
                    'Europe/Paris',  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('compute stats for oauth client registered users', function (done) {
        var clientID = null;

        // MongoDB stores date as UTC.
        // Use a fixed date to not be 
        // fooled when subtracting days or months.
        var today = moment.utc('16-03-2015', 'DD-MM-YYYY').toDate();

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient.call({
                    statistics: {
                        // Needs to match the last count
                        registered_users: 4
                    }
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    clientID = oauthClient.id;

                    cb(null, oauthClient);
                });
            },

            // Used as reference to return in count
            createOauthClientRegisteredUserLog: ['createOauthClient', function (cb, results) {
                createOauthClientRegisteredUserLog({
                    client: clientID,
                    count: 1,
                    previous_count: 0,
                    at: moment.utc(today)
                            .subtract(1, 'years')
                            .toDate()
                }, function (err, registeredUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUser);
                });
            }],

            // Used as reference to return in count
            createOauthClientRegisteredUserLog2: ['createOauthClient', function (cb, results) {
                createOauthClientRegisteredUserLog({
                    client: clientID,
                    count: 2,
                    previous_count: 1,
                    at: moment.utc(today)
                            .subtract(6, 'months')
                            .toDate()
                }, function (err, registeredUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUser);
                });
            }],

            // Used as reference to return in count
            createOauthClientRegisteredUserLog3: ['createOauthClient', function (cb, results) {
                createOauthClientRegisteredUserLog({
                    client: clientID,
                    count: 3,
                    previous_count: 2,
                    at: moment.utc(today)
                            .subtract(3, 'months')
                            .toDate()
                }, function (err, registeredUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUser);
                });
            }],

            // Created in order to check that 
            // `computeStatsForOauthClientRegisteredUsers`
            // takes into account period
            createOauthClientRegisteredUserLog4: ['createOauthClient', function (cb, results) {
                createOauthClientRegisteredUserLog({
                    client: clientID,
                    count: 4,
                    previous_count: 3,
                    at: moment.utc(today)
                            .subtract(1, 'months')
                            .toDate()
                }, function (err, registeredUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUser);
                });
            }],

            // Created in order to check that 
            // `computeStatsForOauthClientRegisteredUsers`
            // takes into account client ID
            createOauthClientRegisteredUserLog5: function (cb) {
                createOauthClientRegisteredUserLog({
                    client: mongoose.Types.ObjectId(),
                    count: 1,
                    previous_count: 0,
                    at: today
                }, function (err, registeredUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUser);
                });
            },

            computeStatsForOauthClientRegisteredUsersForDay: ['createOauthClientRegisteredUserLog', 
                                                             'createOauthClientRegisteredUserLog2', 
                                                             'createOauthClientRegisteredUserLog3', 
                                                             'createOauthClientRegisteredUserLog4', 
                                                             'createOauthClientRegisteredUserLog5', 
                                                             function (cb, results) {
                   
                computeStatsForOauthClientRegisteredUsers(clientID, '1 day', 
                                                         today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthClientRegisteredUsersForMonth: ['createOauthClientRegisteredUserLog', 
                                                               'createOauthClientRegisteredUserLog2', 
                                                               'createOauthClientRegisteredUserLog3', 
                                                               'createOauthClientRegisteredUserLog4', 
                                                               'createOauthClientRegisteredUserLog5', 
                                                               function (cb, results) {
                            
                computeStatsForOauthClientRegisteredUsers(clientID, '1 month', 
                                                         today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthClientRegisteredUsersForYear: ['createOauthClientRegisteredUserLog', 
                                                              'createOauthClientRegisteredUserLog2', 
                                                              'createOauthClientRegisteredUserLog3', 
                                                              'createOauthClientRegisteredUserLog4', 
                                                              'createOauthClientRegisteredUserLog5', 
                                                              function (cb, results) {
                            
                computeStatsForOauthClientRegisteredUsers(clientID, '1 year', 
                                                         today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }]
        }, function (err, results) {
            var statsForDay = results && results.computeStatsForOauthClientRegisteredUsersForDay;
            var statsForMonth = results && results.computeStatsForOauthClientRegisteredUsersForMonth;
            var statsForYear = results && results.computeStatsForOauthClientRegisteredUsersForYear;

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

            assert.strictEqual(statsForDay[thisDay], 4);
            assert.strictEqual(statsForDay[previousDay], 4);
            
            assert.strictEqual(statsForMonth[thisMonth], 4);
            assert.strictEqual(statsForMonth[previousMonth], 4);

            assert.strictEqual(statsForYear[thisYear], 4);
            assert.strictEqual(statsForYear[previousYear], 3);

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