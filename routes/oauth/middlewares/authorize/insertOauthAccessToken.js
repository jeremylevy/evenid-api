var async = require('async');

var insertOauthAccessToken = require('../../../../models/actions/insertOauthAccessToken');

module.exports = function (req, res, next) {
    var oauthAuthorization = res.locals.oauthAuthorization;

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `insertOauthAccessToken` '
                        + 'middleware');
    }

    if (oauthAuthorization.type !== 'token') {
        return next();
    }

    insertOauthAccessToken(oauthAuthorization, function (err, accessToken) {
        if (err) {
            return next(err);
        }

        // Tokens are hashed in db, 
        // send raw value to user
        res.locals.accessTokenToSetInURL = accessToken._token;

        next();
    });
};