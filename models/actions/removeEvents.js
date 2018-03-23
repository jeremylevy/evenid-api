var assert = require('assert');
var Type = require('type-of-is');

var net = require('net');
var async = require('async');

var config = require('../../config');

var db = require('../');

module.exports = function (IPAddress, entities, type, cb) {
    assert.ok(!IPAddress || net.isIP(IPAddress) !== 0,
              'argument `IPAddress` must be an IP address');

    assert.ok(!entities || (Type.is(entities, Object) && Object.keys(entities).length > 0),
              'argument `entities` must be an object literal');
    
    assert.ok(config.EVENID_EVENTS.TYPES.indexOf(type) !== -1,
              'argument `type` must be an event type');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var query = {
        type: type
    };

    if (!IPAddress && !entities) {
        throw new Error('You must pass `IPAddress` or `entities` in order to remove Events');
    }

    if (IPAddress) {
        query.ip_address = IPAddress;
    }

    if (entities) {
        query.entities = entities;
    }

    async.auto({
        removeEvents: function (cb) {
            db.models.Event.remove(query, function (err, event) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};