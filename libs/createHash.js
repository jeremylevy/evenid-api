var assert = require('assert');
var Type = require('type-of-is');

var crypto = require('crypto');

module.exports = function (algo, stringToHash) {
    var availableHashes = crypto.getHashes();

    assert.ok(Type.is(algo, String),
            'argument `algo` must be a string');

    assert.ok(algo.trim().length > 0,
            'argument `algo` must not be empty');

    assert.ok(availableHashes.indexOf(algo) !== -1,
            'argument `algo` is not available');

    assert.ok(Type.is(stringToHash, String) || Type.instance(stringToHash, Buffer),
            'argument `stringToHash` must be a string or a buffer');

    assert.ok(stringToHash.length > 0,
            'argument `stringToHash` must not be empty');

    return crypto
            .createHash(algo)
            .update(stringToHash)
            .digest('hex');
};