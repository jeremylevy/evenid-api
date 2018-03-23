var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment-timezone');

var getOauthClientActiveUsers = require('../../../models/actions/getOauthClientActiveUsers');

var createOauthUserEvent = require('../../../testUtils/db/createOauthUserEvent');
var removeOauthUserEventCollection = require('../../../testUtils/db/removeOauthUserEventCollection');

var testTimezone = function (today, timezone, expectedToday, done) {
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

        getOauthClientActiveUsersForDay: ['createOauthUserEvent', 
                                                     function (cb, results) {
                        
            getOauthClientActiveUsers(clientID, '1 day', 
                                      today, timezone, function (err, stats) {
                if (err) {
                    return cb(err);
                }

                cb(null, stats);
            });
        }]
    }, function (err, results) {
        var statsForDay = results && results.getOauthClientActiveUsersForDay;

        var thisDay = moment.tz(today, timezone)
                            .format('YYYY-MM-DD');

        if (err) {
            return done(err);
        }

        assert.strictEqual(thisDay, expectedToday);

        assert.strictEqual(statsForDay, 1);

        done();
    });
};

describe('models.actions.getOauthClientActiveUsers', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `getOauthClientActiveUsers`
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
                getOauthClientActiveUsers(
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
                getOauthClientActiveUsers(
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
                getOauthClientActiveUsers(
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
                getOauthClientActiveUsers(
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
                getOauthClientActiveUsers(
                    mongoose.Types.ObjectId(), 
                    '1 day',
                    new Date(),
                    'Europe/Paris',  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('returns the number of active users for period', function (done) {
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

            // Event used as reference 
            // to return in count
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
                    created_at: moment(today)
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
            // `getOauthClientActiveUsers`
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
            // `getOauthClientActiveUsers`
            // takes into account period
            createOauthUserEvent6: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: moment(today)
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
            // `getOauthClientActiveUsers`
            // takes into account period
            createOauthUserEvent7: function (cb) {
                createOauthUserEvent({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    type: 'login',
                    created_at: moment(today)
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
                    created_at: today
                }, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            },

            getOauthClientActiveUsersForDay: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                              'createOauthUserEvent3', 'createOauthUserEvent4',
                                              'createOauthUserEvent5', 'createOauthUserEvent6',
                                              'createOauthUserEvent7', 'createOauthUserEvent8',
                                              function (cb, results) {
                            
                getOauthClientActiveUsers(clientID, '1 day', 
                                          today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            getOauthClientActiveUsersForMonth: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                                'createOauthUserEvent3', 'createOauthUserEvent4',
                                                'createOauthUserEvent5', 'createOauthUserEvent6',
                                                'createOauthUserEvent7', 'createOauthUserEvent8',
                                                function (cb, results) {
                            
                getOauthClientActiveUsers(clientID, '1 month', 
                                          today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }],

            getOauthClientActiveUsersForYear: ['createOauthUserEvent', 'createOauthUserEvent2', 
                                               'createOauthUserEvent3', 'createOauthUserEvent4',
                                               'createOauthUserEvent5', 'createOauthUserEvent6',
                                               'createOauthUserEvent7', 'createOauthUserEvent8',
                                               function (cb, results) {
                            
                getOauthClientActiveUsers(clientID, '1 year', 
                                          today, 'UTC', function (err, stats) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, stats);
                });
            }]
        }, function (err, results) {
            var statsForDay = results && results.getOauthClientActiveUsersForDay;
            var statsForMonth = results && results.getOauthClientActiveUsersForMonth;
            var statsForYear = results && results.getOauthClientActiveUsersForYear;

            if (err) {
                return done(err);
            }

            assert.strictEqual(statsForDay, 2);
            assert.strictEqual(statsForMonth, 3);
            assert.strictEqual(statsForYear, 4);

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

        testTimezone(today, timezone, expectedToday, done);
    });
    
    it('compute stats while respecting < UTC timezone', function (done) {
        // We want to check that this event
        // will be assigned to `15-03-2015`
        var today = moment.utc('16-03-2015 04:00:00', 
                               'DD-MM-YYYY HH:mm:ss').toDate();
        // UTC -8
        var timezone = 'America/Los_Angeles';

        var expectedToday = '2015-03-15';

        testTimezone(today, timezone, expectedToday, done);
    });
});