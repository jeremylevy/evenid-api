var assert = require('assert');
var mongoose = require('mongoose');

var config = require('../../../config');

var insertEvent = require('../../../models/actions/insertEvent');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

describe('models.actions.insertEvent', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid event', function () {
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertEvent(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                insertEvent({
                    _id: mongoose.Types.ObjectId()
                }, v);
            }, assert.AssertionError);
        });
    });

    it('returns error when passed invalid IP address', function (done) {
        var IPAddress = 'bar';
        var eventType = 'user_created';
        
        insertEvent({
            ip_address: IPAddress,
            type: eventType
        }, function (err, event) {
            assert.ok(err);
            assert.ok(!event);

            done();
        });
    });

    it('returns error when passed invalid event type', function (done) {
        var IPAddress = '127.0.0.1';
        var eventType = 'bar';
        
        insertEvent({
            ip_address: IPAddress,
            type: eventType
        }, function (err, event) {
            assert.ok(err);
            assert.ok(!event);

            done();
        });
    });

    it('returns event when passed valid values', function (done) {
        var IPAddress = '127.0.0.1';
        var eventType = 'user_created';
        
        insertEvent({
            ip_address: IPAddress,
            type: eventType
        }, function (err, event) {
            if (err) {
                return done(err);
            }

            assert.ok(areValidObjectIDs([event._id]));
            assert.strictEqual(event.type, eventType);
            assert.strictEqual(event.ip_address, IPAddress);

            done();
        });
    });
});