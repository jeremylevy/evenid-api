module.exports = function (req, res, next) {
    var client = res.locals.client;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `setClientToSend` '
                        + 'middleware');
    }

    res.locals.clientToSend = {
        // Used by recover password to customize email sent
        // to user and to name test account cookie
        id: client.id, 
        name: client.name,
        logo: client.logo,
        description: client.description,
        authorize_test_accounts: client.authorize_test_accounts
    };

    next();
};