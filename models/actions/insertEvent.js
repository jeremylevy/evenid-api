var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var db = require('../');

module.exports = function (event, cb) {
    assert.ok(Type.is(event, Object),
              'argument `event` must be an object literal');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        insertEvent: function (cb) {
            db.models.Event.create(event, function (err, event) {
                if (err) {
                    return cb(err);
                }

                cb(null, event);
            });
        }
    }, function (err, results) {
        var event = results && results.insertEvent;

        if (err) {
            return cb(err);
        }

        cb(null, event);
    });
};