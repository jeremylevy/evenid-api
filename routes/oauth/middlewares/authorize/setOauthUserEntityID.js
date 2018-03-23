var findOauthEntitiesID = require('../../../../models/actions/findOauthEntitiesID');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var oauthAuthorization = res.locals.oauthAuthorization;

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `setOauthUserEntityID` '
                        + 'middleware');
    }

    // When `oauthAuthorization.type` was set to `authorization_code`
    // client specific user ID was sent along with access token
    if (oauthAuthorization.type !== 'token') {
        return next();
    }

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `setOauthUserEntityID` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `setOauthUserEntityID` '
                        + 'middleware');
    }

    findOauthEntitiesID({
        real_id: user.id,
        entities: ['users']
    }, user.id, client.id, function (err, oauthEntitiesID) {
        if (err) {
            return next(err);
        }

        res.locals.userIDToSendToClient = oauthEntitiesID[0].fake_id.toString();

        next();
    });
};