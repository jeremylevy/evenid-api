var Type = require('type-of-is');

module.exports = function (value) {
    if (Type.is(value, undefined)
        || Type.is(value, null)) {

        return true;
    }

    if (Type.is(value, String)
        || Type.is(value, Array)) {

        return value.length === 0;
    }

    if (Type.is(value, Object)) {
        return Object.keys(value).length === 0;
    }

    return false;
};