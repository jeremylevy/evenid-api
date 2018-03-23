var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../config');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (scope) {
    var authorizedScope = config.EVENID_OAUTH
                                .VALID_USER_SCOPE
                                .concat(config.EVENID_OAUTH
                                              .VALID_APP_SCOPE);

    assert.ok(Type.is(scope, String)
              || Type.is(scope, Array),
              'argument `scope` is invalid');

    if (Type.is(scope, String)) {
        scope = [scope];
    }

    for (var i = 0, j = scope.length; i < j; ++i) {
        assert.ok(authorizedScope.indexOf(scope[i]) !== -1,
                'argument `scope` is invalid');
    }

    return function (req, res, next) {
        var context = this;
        var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

        var accessToken = res.locals.accessToken;
        var authScope = null;

        var scopeIsContained = false;

        if (!accessToken) {
            throw new Error('`accessToken` must be set as response locals '
                            + 'property before calling `checkScope` '
                            + 'middleware');
        }

        authScope = accessToken.authorization.scope;

        for (var i = 0, j = scope.length; i < j; ++i) {
            if (authScope.indexOf(scope[i]) === -1) {
                continue;
            }

            scopeIsContained = true;
        }

        if (!scopeIsContained) {
            return next(usedDuringOauthAuthorize 
                ? 'route' 
                : new AccessDeniedError());
        }

        return next();
    };
};