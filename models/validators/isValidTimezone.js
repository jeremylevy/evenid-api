var localesData = require('../../locales/data');

var timezones = localesData.timezones;

module.exports = function (timezone) {
    return timezones.indexOf(timezone) !== -1;
};