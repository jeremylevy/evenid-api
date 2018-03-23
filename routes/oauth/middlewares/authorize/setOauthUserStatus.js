var findOauthUserStatus = require('../../../../models/actions/findOauthUserStatus');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var oauthAuthorization = res.locals.oauthAuthorization;

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `setOauthUserStatus` '
                        + 'middleware');
    }

    // When `oauthAuthorization.type` was set to `authorization_code`
    // user status was sent along with access token
    if (oauthAuthorization.type !== 'token') {
        return next();
    }

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `setOauthUserStatus` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `setOauthUserStatus` '
                        + 'middleware');
    }

    findOauthUserStatus(client.id, user.id, function (err, oauthUserStatus) {
        if (err) {
            return next(err);
        }

        res.locals.userStatus = oauthUserStatus.status;

        next();
    });
};