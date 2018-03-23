var Type = require('type-of-is');

var libphonenumber = require('node-phonenumber');

module.exports = function (phoneNumber, region) {
    var phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    var number = null;

    // Don't use assert here because `phoneNumber` 
    // and `region` can contain
    // value passed through form by user
    if (!Type.is(phoneNumber, String) 
        || !Type.is(region, String)) {

        return false;
    }

    // libphonenumber throw exceptions, so enclose it in a try/catch block
    try {
        number = phoneUtil.parseAndKeepRawInput(phoneNumber, region);

        return phoneUtil.isValidNumberForRegion(number, region);
    } catch (e) {
        return false;
    }
};