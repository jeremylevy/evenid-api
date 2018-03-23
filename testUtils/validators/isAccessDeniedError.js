var assert = require('assert');
var Type = require('type-of-is');

module.exports = function (error) {
    assert.strictEqual(error.type, 'access_denied');

    assert.ok(Type.is(error.messages, Object));
    assert.strictEqual(Object.keys(error.messages).length, 1);

    assert.ok(Type.is(error.messages.main, String));
    assert.ok(error.messages.main.length > 0);
};