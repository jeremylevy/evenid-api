var Type = require('type-of-is');

var updateOauthClientRegisteredUsers = require('../../../../models/actions/updateOauthClientRegisteredUsers');

module.exports = function (req, res, next) {
    var flow = req.query.flow;

    var client = res.locals.client;
    var user = res.locals.user;

    var useTestAccount = res.locals.useTestAccount;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `updateOauthClientRegisteredUsers` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `updateOauthClientRegisteredUsers` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `insertOauthAuthorization` '
                        + 'middleware');
    }

    if (flow !== 'registration') {
        return next();
    }

    if (useTestAccount) {
        return next();
    }

    updateOauthClientRegisteredUsers(user.id, client.id, 1, function (err) {
        if (err) {
            return next(err);
        }

        next();
    });
};