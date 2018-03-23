var assert = require('assert');
var Type = require('type-of-is');

function InvalidTokenError (message) {
    assert.ok(!message || Type.is(message, String),
              'argument `message` must be a string');

    assert.ok(!message || message.trim().length > 0,
              'argument `message` must not be empty');

    this.message = message || 'Your access token is invalid.';
}

InvalidTokenError.prototype = new Error();
InvalidTokenError.prototype.constructor = InvalidTokenError;

module.exports = InvalidTokenError;