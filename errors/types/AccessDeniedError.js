var assert = require('assert');
var Type = require('type-of-is');

function AccessDeniedError (message) {
    assert.ok(!message || Type.is(message, String),
              'argument `message` must be a string');

    assert.ok(!message || message.trim().length > 0,
              'argument `message` must not be an empty string');

    this.message = message || 'You are not authorized to access this resource.';
}

AccessDeniedError.prototype = new Error();
AccessDeniedError.prototype.constructor = AccessDeniedError;

module.exports = AccessDeniedError;