var assert = require('assert');
var Type = require('type-of-is');

function MaxAttemptsError (message, captchaError) {
    var captchaErrorIsBoolean = Type.is(captchaError, Boolean);

    assert.ok(!message || Type.is(message, String),
              'argument `message` must be a string');

    assert.ok(!message || message.trim().length > 0,
              'argument `message` must not be empty');

    assert.ok(!captchaError || captchaErrorIsBoolean,
              'argument `captchaError` must be a boolean');

    this.message = message || 'Too many attempts were made. Please try again later.';
    this.captchaError = captchaErrorIsBoolean ? captchaError : false;
}

MaxAttemptsError.prototype = new Error();
MaxAttemptsError.prototype.constructor = MaxAttemptsError;

module.exports = MaxAttemptsError;