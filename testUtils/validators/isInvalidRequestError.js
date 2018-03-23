var assert = require('assert');
var Type = require('type-of-is');

module.exports = function (error, messageProperties) {
    messageProperties = messageProperties || [];

    assert.ok(Type.is(error, Object));

    assert.strictEqual(error.type, 'invalid_request');

    assert.ok(Type.is(error.messages, Object));
    
    // Add `+1` for the main message
    assert.strictEqual(Object.keys(error.messages).length, messageProperties.length + 1);

    assert.ok(Type.is(error.messages.main, String));
    assert.ok(error.messages.main.length > 0);

    messageProperties.forEach(function (messageProperty) {
        assert.ok(Type.is(error.messages[messageProperty], String));
        assert.ok(error.messages[messageProperty].length > 0);
    });
};