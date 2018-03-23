var assert = require('assert');
var Type = require('type-of-is');

var crypto = require('crypto');
var mongoose = require('mongoose');

var createHash = require('./createHash');

module.exports = function (cb) {
    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    crypto.randomBytes(256, function (err, randomBytesBuffer) {
        var token = null;
        // Add uniqueness to hash
        var IDBuffer = new Buffer(mongoose.Types.ObjectId().toString());
        var entireBuffer = null;

        if (err) {
            return cb(err);
        }

        entireBuffer = Buffer.concat([IDBuffer, randomBytesBuffer]);

        token = createHash('sha1', entireBuffer);

        cb(null, token);
    });
};