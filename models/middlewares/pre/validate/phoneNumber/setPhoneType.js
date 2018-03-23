var assert = require('assert');
var Type = require('type-of-is');

var libphonenumber = require('node-phonenumber');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (next) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as a `PhoneNumber` document');
    
    assert.ok(Type.is(next, Function),
              'argument `next` must be a function');

    var phoneNumber = this;
    var phoneType = phoneNumber.phone_type;
    
    var modifiedFields = phoneNumber.modifiedPaths();
    var phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    
    var parsedPhoneNumber = null;
    var phoneNumberType = null;

    // Make sure phone type
    // match number if it was updated
    if (modifiedFields.indexOf('number') !== -1
        && modifiedFields.indexOf('phone_type') === -1) {

        phoneNumber.phone_type = phoneType = undefined;
    }

    if (phoneType && phoneType !== 'unknown') {
        return next();
    }

    // If we don't have phone 
    // type try to guess it
    try {
        parsedPhoneNumber = phoneUtil.parse(phoneNumber.number, phoneNumber.country);
        phoneNumberType = phoneUtil.getNumberType(parsedPhoneNumber);

        if (phoneNumberType === libphonenumber.PhoneNumberType.FIXED_LINE) {
            phoneNumber.phone_type = 'landline';
        } else if (phoneNumberType === libphonenumber.PhoneNumberType.MOBILE) {
            phoneNumber.phone_type = 'mobile';
        }
    } catch (e) {
        // Invalid number
        // do nothing, managed 
        // during model validation
    }

    if (!phoneNumber.phone_type) {
        phoneNumber.phone_type = 'unknown';
    }

    next();
};