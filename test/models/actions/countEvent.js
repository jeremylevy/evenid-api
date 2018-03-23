var assert = require('assert');

var async = require('async');

var countEvent = require('../../../models/actions/countEvent');

var createEvent = require('../../../testUtils/db/createEvent');
var removeEventCollection = require('../../../testUtils/db/removeEventCollection');

describe('models.actions.countEvent', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `countEvent` query is based on date
            // make sure `Event` collection is empty
            removeEventCollection(function (err) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });

    it('throws an exception when passing '
       + 'invalid/non-false IP address', function () {
        
        [{}, 9, [], '127.', '127.0.'].forEach(function (v) {
            assert.throws(function () {
                countEvent(v,
                           {},
                           'invalid_login', 
                           86400, 
                           function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-object/empty-object/non-false '
       + 'value as entities', function () {
        
        [{}, 9, [], 'foo'].forEach(function (v) {
            assert.throws(function () {
                countEvent('127.0.0.1',
                           v,
                           'invalid_login', 
                           86400, 
                           function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid event type', function () {
        [null, undefined, {}, 9, [], 'bar', 'foo'].forEach(function (v) {
            assert.throws(function () {
                countEvent('127.0.0.1',
                           {},
                           v, 
                           86400, 
                           function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid timeout', function () {
        [null, undefined, {}, [], '', 'bar'].forEach(function (v) {
            assert.throws(function () {
                countEvent('127.0.0.1',
                           {},
                           'invalid_login', 
                           v, 
                           function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], '', 'bar'].forEach(function (v) {
            assert.throws(function () {
                countEvent('127.0.0.1',
                           {},
                           'invalid_login', 
                           86400, 
                           v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when IP address '
       + 'and entities are not set', function () {
        
        assert.throws(function () {
            countEvent(undefined, undefined, 'user_created', 86400, function () {});
        }, Error);
    });

    it('returns events between (now minus timeout) and (now)', function (done) {
        var IPAddress = '127.0.0.1';
        var eventType = 'invalid_login';
        var email = 'foo@evenid.com';

        async.auto({
            // Event used as reference to returns in count
            createEvent: function (cb) {
                createEvent({
                    ip_address: IPAddress,
                    type: eventType,
                    'entities.email': email,
                    created_at: new Date()
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Created in order to check that `countEvent`
            // takes into account IP address
            createEvent2: function (cb) {
                createEvent({
                    ip_address: '192.168.1.1',
                    type: eventType,
                    'entities.email': email,
                    created_at: new Date()
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Created in order to check that `countEvent`
            // takes into account entities
            createEvent3: function (cb) {
                createEvent({
                    ip_address: IPAddress,
                    type: eventType,
                    'entities.email': 'bar@evenid.com',
                    created_at: new Date()
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Created in order to check that `countEvent`
            // takes into account event type
            createEvent4: function (cb) {
                createEvent({
                    ip_address: IPAddress,
                    type: 'user_created',
                    'entities.email': email,
                    created_at: new Date()
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            // Created in order to check that `countEvent`
            // takes into account timeout
            createEvent5: function (cb) {
                var date = new Date();

                date.setTime(date.getTime() - (86401 * 1000));

                createEvent({
                    ip_address: IPAddress,
                    type: eventType,
                    'entities.email': email,
                    created_at: date
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            },

            countEvent: ['createEvent', 'createEvent2', 
                         'createEvent3', 'createEvent4', 
                         'createEvent5', function (cb, results) {
                            
                countEvent('127.0.0.1', {
                    email: email
                }, 'invalid_login', 86400, function (err, count) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, count);
                });
            }]
        }, function (err, results) {
            var count = results.countEvent;

            if (err) {
                return done(err);
            }

            assert.strictEqual(count, 1);

            done();
        });
    });
});