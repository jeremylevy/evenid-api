var Type = require('type-of-is');

var findUserAuthorizationForClient = require('../../../../models/actions/findUserAuthorizationForClient');

var AccessDeniedError = require('../../../../errors/types/AccessDeniedError');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var useTestAccount = res.locals.useTestAccount;

    if (req.method !== 'POST') {
        throw new Error('`checkUserCanUseTestAccount` middleware must be used '
                        + 'during `POST` requests');
    }

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `checkUserCanUseTestAccount` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `checkUserCanUseTestAccount` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `checkUserCanUseTestAccount` '
                        + 'middleware');
    }

    // Make sure user doesn't use test account
    // after registering on client
    if (useTestAccount) {
        findUserAuthorizationForClient(user._id, client._id, function (err, userAuthorization) {
            if (err) {
                return next(err);
            }

            // Used in `findFieldsToAuthorize` and 
            // `prepareOauthAuthorization` middleware in order
            // to avoid doing the same request multiple times
            // And to check if registered user try to register once again
            // in `authorizeUnloggedUser` POST methods
            res.locals.userAuthorizationForClient = userAuthorization;

            // User is already registered
            if (userAuthorization.scope.length > 0) {
                return next(new AccessDeniedError('You cannot use test account anymore with this client.'));
            }

            next();
        });

        return;
    }

    next();
};