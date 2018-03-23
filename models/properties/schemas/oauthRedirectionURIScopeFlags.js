var config = require('../../../config');

var isValidOauthScopeFlags = require('../../validators/isValidOauthScopeFlags')
                                    (config.EVENID_OAUTH.VALID_USER_SCOPE_FLAGS);

var isEmpty = require('../../validators/isEmpty');

module.exports = function () {
    return {
        type: Array,
        default: [],
        validate: [{
            validator: function (scopeFlags) {
                // May be empty
                return isEmpty(scopeFlags) 
                    || isValidOauthScopeFlags(scopeFlags);
            },
            msg: 'Scope flags contains invalid values.'
        }]
    };
};