var Type = require('type-of-is');

var insertOauthAuthorization = require('../../../../models/actions/insertOauthAuthorization');

module.exports = function (req, res, next) {
    var oauthAuthorization = res.locals.oauthAuthorization;
    var authorizedEntities = res.locals.authorizedEntities;

    var useTestAccount = res.locals.useTestAccount;

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `insertOauthAuthorization` '
                        + 'middleware');
    }

    if (!authorizedEntities) {
        throw new Error('`authorizedEntities` must be set as response locals '
                        + 'property before calling `insertOauthAuthorization` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `insertOauthAuthorization` '
                        + 'middleware');
    }

    insertOauthAuthorization(useTestAccount, 
                             authorizedEntities, 
                             oauthAuthorization, 
                             function (err, oauthAuthorization) {
        if (err) {
            return next(err);
        }

        res.locals.oauthAuthorization = oauthAuthorization;

        next();
    });
};