var assert = require('assert');
var Type = require('type-of-is');
var compareobject = require('objectcompare');

module.exports = function (a, b) {
    var _toString = function (v) {
        return v.toString();
    };

    if (Type.is(a, undefined)
        || Type.is(b, undefined)) {

        return false;
    }

    if (!Type.is(a, Array)) {
        a = [a];
    }

    if (!Type.is(b, Array)) {
        b = [b];
    }

    if (a.length !== b.length) {
        return false;
    }

    // Compare as string
    a = a.map(_toString);
    b = b.map(_toString);

    for (var i = 0, j = a.length; i < j; ++i) {
        loop1:
            if (b.indexOf(a[i]) === -1) {
                // Compare Object
                if (Type.is(a[i], Object)) {
                    // For each b value
                    for (var k = 0, l = b.length; k < l; ++k) {
                        // Test each object
                        if (Type.is(b[k], Object)) {
                            // If objects are equal go to loop 1
                            if (compareobject(b[k], a[i]).equal) {
                                break loop1;
                            }
                        }
                    }
                }

                return false;
            }
    }

    return true;
};