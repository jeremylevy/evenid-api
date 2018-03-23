var assert = require('assert');
var Type = require('type-of-is');

module.exports = function (validScopeValues) {
    assert.ok(Type.is(validScopeValues, Array), 
            'argument `validScopeValues` must be an array');

    assert.ok(validScopeValues.length > 0, 
            'argument `validScopeValues` must not be an empty array');

    return function (scope) {
        assert.ok(Type.is(scope, Array), 
                'argument `scope` must be an array');

        assert.ok(scope.length > 0, 
                  'argument `scope` must not be an empty array');

        for (var i = 0, j = scope.length; i < j; ++i) {
            if (validScopeValues.indexOf(scope[i]) === -1) {
                return false;
            }
        }

        return true;
    }
};