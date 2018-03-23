var assert = require('assert');
var Type = require('type-of-is');

function NotFoundError (message) {
    assert.ok(!message || Type.is(message, String),
              'argument `message` must be a string');

    assert.ok(!message || message.trim().length > 0,
              'argument `message` must not be empty');

    this.message = message || 'The requested resource was not found.';
}

NotFoundError.prototype = new Error();
NotFoundError.prototype.constructor = NotFoundError;

module.exports = NotFoundError;