var assert = require('assert');

var config = require('../config');

var localesData = require('../locales/data');

module.exports = function (locale, wantedTimezone) {
    assert.ok(config.EVENID_LOCALES.ENABLED.indexOf(locale) !== -1,
              'argument `locale` is invalid');

    assert.ok(localesData.timezones.indexOf(wantedTimezone) !== -1,
              'argument `wantedTimezone` is invalid');

    var timezones = localesData[locale].timezones;
    var timezoneToReturn = 'UTC';

    Object.keys(timezones).forEach(function (continent) {
        Object.keys(timezones[continent]).forEach(function (timezone) {
            if (wantedTimezone !== timezone) {
                return;
            }

            timezoneToReturn = timezones[continent][timezone];
        });
    });

    return timezoneToReturn;
};