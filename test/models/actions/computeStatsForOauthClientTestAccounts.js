var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment-timezone');

var computeStatsForOauthClientTestAccountsConversionRate = require('../../../models/actions/computeStatsForOauthClientTestAccountsConversionRate');

var createOauthClientTestAccountLog = require('../../../testUtils/db/createOauthClientTestAccountLog');
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
                    test_accounts: {
                        registered: 1,
                        converted: 0
                    }
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
        createOauthClientTestAccountLog: ['createOauthClient', function (cb, results) {
            createOauthClientTestAccountLog({
                client: clientID,
                count: {
                    registered: 1,
                    converted: 0
                },
                previous_count: {
                    registered: 0,
                    converted: 0
                },
                at: today
            }, function (err, registeredUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, registeredUser);
            });
        }],

        computeStatsForOauthClientTestAccountsConversionRateForDay: ['createOauthClientTestAccountLog', 
                                                                     function (cb, results) {
               
            computeStatsForOauthClientTestAccountsConversionRate(clientID, '1 day', 
                                                                 today, timezone, function (err, stats) {
                if (err) {
                    return cb(err);
                }

                cb(null, stats);
            });
        }],
    }, function (err, results) {
        var statsForDay = results && results.computeStatsForOauthClientTestAccountsConversionRateForDay;

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

        assert.strictEqual(statsForDay[thisDay], 0);
        assert.strictEqual(statsForDay[previousDay], 0);

        done();
    });
};

describe('models.actions.computeStatsForOauthClientTestAccountsConversionRate', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `computeStatsForOauthClientTestAccountsConversionRate` 
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
                computeStatsForOauthClientTestAccountsConversionRate(
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
                computeStatsForOauthClientTestAccountsConversionRate(
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
                computeStatsForOauthClientTestAccountsConversionRate(
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
                computeStatsForOauthClientTestAccountsConversionRate(
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
                computeStatsForOauthClientTestAccountsConversionRate(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    new Date(),
                    'Europe/Paris',  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('compute conversion rate for oauth client test accounts', function (done) {
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
                        test_accounts: {
                            registered: 4,
                            converted: 2
                        }
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
            createOauthClientTestAccountLog: ['createOauthClient', function (cb, results) {
                createOauthClientTestAccountLog({
                    client: clientID,
                    
                    count: {
                        registered: 1,
                        converted: 0
                    },
                    
                    previous_count: {
                        registered: 0,
                        converted: 0
                    },
                    
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
            createOauthClientTestAccountLog2: ['createOauthClient', function (cb, results) {
                createOauthClientTestAccountLog({
                    client: clientID,
                    
                    count: {
                        registered: 2,
                        converted: 1
                    },
                    
                    previous_count: {
                        registered: 1,
                        converted: 0
                    },
                    
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
            createOauthClientTestAccountLog3: ['createOauthClient', function (cb, results) {
                createOauthClientTestAccountLog({
                    client: clientID,
                    
                    count: {
                        registered: 3,
                        converted: 2
                    },
                    
                    previous_count: {
                        registered: 2,
                        converted: 1
                    },
                    
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
            // `computeStatsForOauthClientTestAccountsConversionRate`
            // takes into account period
            createOauthClientTestAccountLog4: ['createOauthClient', function (cb, results) {
                createOauthClientTestAccountLog({
                    client: clientID,
                    
                    count: {
                        registered: 4,
                        converted: 2
                    },
                    
                    previous_count: {
                        registered: 3,
                        converted: 2
                    },

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
            // `computeStatsForOauthClientTestAccountsConversionRate`
            // takes into account client ID
            createOauthClientTestAccountLog5: function (cb) {
                createOauthClientTestAccountLog({
                    client: mongoose.Types.ObjectId(),
                    
                    count: {
                        registered: 1,
                        converted: 0
                    },
                    
                    previous_count: {
                        registered: 0,
                        converted: 0
                    },
                    
                    at: today
                }, function (err, registeredUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, registeredUser);
                });
            },

            computeStatsForOauthClientTestAccountsConversionRateForDay: ['createOauthClientTestAccountLog', 
                                                                         'createOauthClientTestAccountLog2', 
                                                                         'createOauthClientTestAccountLog3', 
                                                                         'createOauthClientTestAccountLog4', 
                                                                         'createOauthClientTestAccountLog5', 
                                                                         function (cb, results) {
                   
                computeStatsForOauthClientTestAccountsConversionRate(clientID, '1 day', 
                                                                     today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthClientTestAccountsConversionRateForMonth: ['createOauthClientTestAccountLog', 
                                                                           'createOauthClientTestAccountLog2', 
                                                                           'createOauthClientTestAccountLog3', 
                                                                           'createOauthClientTestAccountLog4', 
                                                                           'createOauthClientTestAccountLog5', 
                                                                           function (cb, results) {
                            
                computeStatsForOauthClientTestAccountsConversionRate(clientID, '1 month', 
                                                                     today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            computeStatsForOauthClientTestAccountsConversionRateForYear: ['createOauthClientTestAccountLog', 
                                                                          'createOauthClientTestAccountLog2', 
                                                                          'createOauthClientTestAccountLog3', 
                                                                          'createOauthClientTestAccountLog4', 
                                                                          'createOauthClientTestAccountLog5', 
                                                                          function (cb, results) {
                            
                computeStatsForOauthClientTestAccountsConversionRate(clientID, '1 year', 
                                                                     today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }]
        }, function (err, results) {
            var statsForDay = results && results.computeStatsForOauthClientTestAccountsConversionRateForDay;
            var statsForMonth = results && results.computeStatsForOauthClientTestAccountsConversionRateForMonth;
            var statsForYear = results && results.computeStatsForOauthClientTestAccountsConversionRateForYear;

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

            assert.strictEqual(statsForDay[thisDay], 0.5);
            assert.strictEqual(statsForDay[previousDay], 0.5);
            
            assert.strictEqual(statsForMonth[thisMonth], 0.5);
            assert.strictEqual(statsForMonth[previousMonth], 0.5);

            assert.strictEqual(statsForYear[thisYear], 0.5);
            assert.strictEqual(statsForYear[previousYear], 0.67);

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