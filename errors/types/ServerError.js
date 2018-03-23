var assert = require('assert');
var Type = require('type-of-is');

function ServerError (errors) {
    assert.ok(Type.is(errors, Array),
              'argument `errors` must be an array');

    // Array of unmanaged errors.
    this.errors = errors;
}

ServerError.prototype = new Error();
ServerError.prototype.constructor = ServerError;

module.exports = ServerError;