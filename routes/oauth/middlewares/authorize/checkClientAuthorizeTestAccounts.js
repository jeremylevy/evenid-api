var AccessDeniedError = require('../../../../errors/types/AccessDeniedError');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var useTestAccount = (req.body.use_test_account === 'true');

    if (req.method !== 'POST') {
        throw new Error('`checkClientAuthorizeTestAccounts` middleware must be used '
                        + 'during `POST` requests');
    }

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `checkClientAuthorizeTestAccounts` '
                        + 'middleware');
    }

    // Make sure client authorize test accounts
    if (useTestAccount
        && !client.authorize_test_accounts) {

        return next(new AccessDeniedError());
    }

    res.locals.useTestAccount = useTestAccount;

    next();
};