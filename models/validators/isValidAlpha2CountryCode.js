var Type = require('type-of-is');

var localesData = require('../../locales/data');

var countryCodes = localesData.alpha2CountryCodes;

module.exports = function (country) {
    // Don't use assert here
    // `country` may be passed by user through form
    if (Type.is(country, String)) {
        country = country.toUpperCase();
    }

    return countryCodes.indexOf(country) !== -1;
};