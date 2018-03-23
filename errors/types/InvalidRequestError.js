var assert = require('assert');
var Type = require('type-of-is');

function InvalidRequestError (messages, mongooseValidationErrors) {
    assert.ok(!messages || Type.is(messages, Object),
              'argument `messages` must be an object literal');

    assert.ok(!mongooseValidationErrors || Type.is(mongooseValidationErrors, Object),
              'argument `mongooseValidationErrors` must be an object literal');

    this.messages = messages || {};
    this.mongooseValidationErrors = mongooseValidationErrors || {};
}

InvalidRequestError.prototype = new Error();
InvalidRequestError.prototype.constructor = InvalidRequestError;

module.exports = InvalidRequestError;