var assert = require('assert');

var libphonenumber = require('node-phonenumber');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Returns phone number in international format
// Virtual property so no passed argument
module.exports = function () {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as a `PhoneNumber` document');

    var phoneNumber = this;
    var internationalNumber = null;

    var phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    
    // Given that `toObject` options were set to send virtuals 
    // we may have a falsy value as number. 
    // So make sure to catch the thrown exception.
    try {
        internationalNumber = phoneUtil.parse(phoneNumber.number, 
                                            phoneNumber.country);
        
        internationalNumber = phoneUtil.format(internationalNumber, 
                                            libphonenumber.PhoneNumberFormat.E164);
    } catch (e) {}

    return internationalNumber;
};