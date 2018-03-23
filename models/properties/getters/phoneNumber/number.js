var assert = require('assert');
var Type = require('type-of-is');

var libphonenumber = require('node-phonenumber');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Returns number in user country format
module.exports = function (number) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as a `PhoneNumber` document');

    assert.ok(Type.is(number, String),
            'argument `number` must be a string');

    var phoneNumber = this;
    var phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    
    // Given that `toObject` options were set to send getters 
    // we may have a falsy value as number. 
    // So make sure to catch the thrown exception.
    try {
        number = phoneUtil.parse(number, phoneNumber.country);
        number = phoneUtil.format(number, libphonenumber.PhoneNumberFormat.NATIONAL);
    } catch (e) {}

    return number;
};