var assert = require('assert');

var async = require('async');

var removeEvents = require('../../../models/actions/removeEvents');

var createEvent = require('../../../testUtils/db/createEvent');
var findEvents = require('../../../testUtils/db/findEvents');

var removeEventCollection = require('../../../testUtils/db/removeEventCollection');

describe('models.actions.removeEvents', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Make sure `Event` collection is empty
            // before testing for deletion
            removeEventCollection(function (err) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });

    it('throws an exception when passing invalid IP address', function () {
        [{}, 9, [], 'bar', function () {}].forEach(function (v) {
            assert.throws(function () {
                removeEvents(v, {}, 'user_created', function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-object/empty-object value as entities', function () {
        [{}, 9, [], 'bar', function () {}].forEach(function (v) {
            assert.throws(function () {
                removeEvents('127.0.0.1', v, 'user_created', function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid event type', function () {
        [null, undefined, false, 9, [], 'bar', function () {}].forEach(function (v) {
            assert.throws(function () {
                removeEvents('127.0.0.1', {}, v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, false, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeEvents('127.0.0.1', {}, 'user_created', v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when IP address and entities are not set', function () {
        assert.throws(function () {
            removeEvents(undefined, undefined, 'user_created', function () {});
        }, Error);
    });

    it('remove events when only IP address was passed', function (done) {
        createEvent({
            ip_address: '127.0.0.1',
            type: 'user_created',
            created_at: new Date()
        }, function (err, event) {
            if (err) {
                return cb(err);
            }

            removeEvents(event.ip_address, null, event.type, function (err) {
                if (err) {
                    return cb(err);
                }

                findEvents([event.id], function (err, events) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(events.length, 0);

                    done();
                });
            });
        });
    });

    it('remove events when only entities were passed', function (done) {
        createEvent({
            ip_address: '127.0.0.1',
            type: 'invalid_login',
            'entities.email': 'foo@evenid.com',
            created_at: new Date()
        }, function (err, event) {
            if (err) {
                return cb(err);
            }

            removeEvents(null, event.entities.toObject(), event.type, function (err) {
                if (err) {
                    return cb(err);
                }

                findEvents([event.id], function (err, events) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(events.length, 0);

                    done();
                });
            });
        });
    });

    it('remove events when IP address and entities were passed', function (done) {
        var eventType = 'invalid_login';
        var email = 'foo@evenid.com';

        async.auto({
            createEvent: function (cb) {
                createEvent({
                    ip_address: '127.0.0.1',
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

            createEvent2: function (cb) {
                createEvent({
                    ip_address: '192.168.1.11',
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

            // Remove only the first event
            removeEvents: ['createEvent', 'createEvent2', function (cb, results) {
                var event = results.createEvent;

                removeEvents(event.ip_address, event.entities.toObject(), event.type, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            findEvents: ['removeEvents', function (cb, results) {
                var event = results.createEvent;
                var event2 = results.createEvent2;

                findEvents([event.id, event2.id], function (err, events) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, events);
                });
            }]
        }, function (err, results) {
            var event2 = results && results.createEvent2;
            var events = results && results.findEvents;

            if (err) {
                return cb(err);
            }

            /* Make sure event found is the second */

            assert.strictEqual(events.length, 1);
            assert.strictEqual(events[0].id, event2.id);

            done();
        });
    });
});