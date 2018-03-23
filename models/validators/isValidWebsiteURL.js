var Type = require('type-of-is');

var validator = require('validator');

module.exports = function (URL) {
    // Don't use assert here because `URL` can contains
    // value passed through form by user
    if (!Type.is(URL, String)) {
        return false;
    }

    return validator.isURL(URL, {
        protocols: ['http','https'], 
        require_tld: true, 
        require_protocol: true, 
        allow_underscores: true
    });
};