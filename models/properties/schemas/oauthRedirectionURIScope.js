var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../config');

var IsValidOauthScope = require('../../validators/isValidOauthScope');

var isEmpty = require('../../validators/isEmpty');

module.exports = function (validScopeValues) {
    assert.ok(Type.is(validScopeValues, Array), 
            'argument `validScopeValues` must be an array');

    assert.ok(validScopeValues.length > 0, 
            'argument `validScopeValues` must not be an empty array');

    var isValidOauthScope = IsValidOauthScope(validScopeValues);

    return {
        type: Array,
        required: true,
        // Empty user authorization may be created
        // easier to manage empty array than undefined
        default: [],
        validate: [
            {
                // Make sure `scope` is not an empty array
                validator: function (scope) {
                    return !isEmpty(scope);
                },
                msg: 'Scope must be set.'
            },

            {
                validator: function (scope) {
                    return isValidOauthScope(scope);
                },
                msg: 'Scope contains invalid values.'
            }
        ]
    };
};