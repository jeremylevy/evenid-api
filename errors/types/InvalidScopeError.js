var assert = require('assert');
var Type = require('type-of-is');

function InvalidScopeError (message) {
    assert.ok(!message || Type.is(message, String),
              'argument `message` must be a string');

    assert.ok(!message || message.trim().length > 0,
              'argument `message` must not be empty');

    this.message = message || 'Your access token scope doesn\'t cover requested ressource.';
}

InvalidScopeError.prototype = new Error();
InvalidScopeError.prototype.constructor = InvalidScopeError;

module.exports = InvalidScopeError;