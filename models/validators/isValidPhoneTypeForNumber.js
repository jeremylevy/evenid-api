var assert = require('assert');
var Type = require('type-of-is');

var libphonenumber = require('node-phonenumber');

var config = require('../../config');

var areValidObjectIDs = require('./areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (number) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as a `PhoneNumber` document');

    // Don't use assert for `number` here 
    // because it can contains
    // value passed through form by user

    var phoneNumber = this;
    var phoneType = phoneNumber.phone_type;
    
    var phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    var parsedPhoneNumber = null;
    var phoneNumberType = null;

    if (!phoneType || phoneType === 'unknown') {
        return true;
    }

    try {
        parsedPhoneNumber = phoneUtil.parse(number, phoneNumber.country);
        phoneNumberType = phoneUtil.getNumberType(parsedPhoneNumber);

        if (phoneNumberType === libphonenumber.PhoneNumberType.FIXED_LINE
            && phoneType === 'mobile'
            
            || phoneNumberType === libphonenumber.PhoneNumberType.MOBILE
                && phoneType === 'landline') {
            
            return false;
        }

        return true;
    } catch (e) {
        return false;
    }
};