var assert = require('assert');
var Type = require('type-of-is');

var InvalidRequestError = require('./InvalidRequestError');

function IPHeaderMissingError () {
    this.messages = {
        'X-Originating-IP': 'The "x-originating-ip" header must be set.'
    };
}

IPHeaderMissingError.prototype = new InvalidRequestError();
IPHeaderMissingError.prototype.constructor = IPHeaderMissingError;

module.exports = IPHeaderMissingError;