var assert = require('assert');
var Type = require('type-of-is');

module.exports = function (validScopeFlags) {
    assert.ok(Type.is(validScopeFlags, Array), 
            'argument `validScopeFlags` must be an array');

    assert.ok(validScopeFlags.length > 0, 
            'argument `validScopeFlags` must not be an empty array');

    return function (scopeFlags) {
        assert.ok(Type.is(scopeFlags, Array), 
                'argument `scopeFlags` must be an array');

        assert.ok(scopeFlags.length > 0, 
                'argument `scopeFlags` must not be an empty array');

        for (var i = 0, j = scopeFlags.length; i < j; ++i) {
            if (validScopeFlags.indexOf(scopeFlags[i]) === -1) {
                return false;
            }
        }

        return true;
    }
};