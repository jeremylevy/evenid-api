var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../config');

var areValidObjectIDs = require('../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function () {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `OauthAuthorization` document');

    var oauthAuthorization = this;
    var oauthAuthorizationScope = oauthAuthorization.scope;
    
    var validAppScope = config.EVENID_OAUTH.VALID_APP_SCOPE;
    var hasAppScope = false;

    if (oauthAuthorizationScope.length === 0) {
        return false;
    }

    oauthAuthorizationScope.forEach(function (scope) {
        if (validAppScope.indexOf(scope) !== -1) {
            hasAppScope = true;
        }
    });

    return hasAppScope;
};