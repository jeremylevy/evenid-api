var assert = require('assert');
var Type = require('type-of-is');

var validator = require('validator');

module.exports = function (pattern) {
    var reg = null;

    assert.ok(Type.is(pattern, String),
              'argument `pattern` must be a string');

    assert.ok(pattern.trim().length > 0,
              'argument `pattern` must be a non-empty string');

    reg = new RegExp('^' + pattern + '$');

    return function (objectIDs) {
        var objectID = null;

        assert.ok(Type.is(objectIDs, Array), 
                  'argument `objectIDs` must be an array');

        assert.ok(objectIDs.length > 0, 
                  'argument `objectIDs` must be a non-empty array');

        for (var i = 0, j = objectIDs.length; i < j; ++i) {
            objectID = objectIDs[i];

            // Use validator here because objectID 
            // can be a non-string value
            if (!validator.matches(objectID, reg)) {
                return false;
            }
        }

        return true;
    };
};