var assert = require('assert');
var Type = require('type-of-is');

function ExpiredTokenError (message) {
    assert.ok(!message || Type.is(message, String),
              'argument `message` must be a string');

    assert.ok(!message || message.trim().length > 0,
              'argument `message` must not be empty');

    this.message = message || 'Your access token has expired.';
}

ExpiredTokenError.prototype = new Error();
ExpiredTokenError.prototype.constructor = ExpiredTokenError;

module.exports = ExpiredTokenError;