var net = require('net');

var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// `timeout` -> Seconds to substract from current date
module.exports = function (IPAddress, entities, type, timeout, cb) {
    assert.ok(!IPAddress || net.isIP(IPAddress) !== 0,
              'argument `IPAddress` must be an IP address');

    assert.ok(!entities || (Type.is(entities, Object) 
                            && Object.keys(entities).length > 0),
              'argument `entities` must be an object literal');
    
    assert.ok(config.EVENID_EVENTS.TYPES.indexOf(type) !== -1,
              'argument `type` must be an event type');

    assert.ok(Type.is(timeout, Number),
              'argument `timeout` must be a number of seconds');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var pastDate = new Date();
    var query = {};

    pastDate.setTime(pastDate.getTime() - (timeout * 1000));

    query = {
        type: type,
        created_at: {
            $gte: pastDate
        }
    };

    if (!IPAddress && !entities) {
        throw new Error('You must pass `IPAddress` or '
                        + '`entities` parameter in order to count Events');
    }

    if (IPAddress) {
        query.ip_address = IPAddress;
    }

    if (entities) {
        Object.keys(entities).forEach(function (entity) {
            query['entities.' + entity] = entities[entity];
        });
    }

    db.models.Event.count(query, function (err, count) {
        if (err) {
            return cb(err);
        }

        cb(null, count);
    });
};