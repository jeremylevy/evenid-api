var Type = require('type-of-is');

var setDeleteTestAccountCookieResp = require('../../callbacks/setDeleteTestAccountCookieResp');

module.exports = function (usedFor) {
    return function (req, res, next) {
        var client = res.locals.client;
        var redirectTo = res.locals.redirectTo;
        
        var userUseTestAccount = res.locals.useTestAccount;
        var accessTokenToSend = res.locals.accessTokenToSend

        var resp = {};

        if (!client) {
            throw new Error('`client` must be set as response locals '
                            + 'property before calling `sendResponse` '
                            + 'middleware');
        }

        if (!redirectTo) {
            throw new Error('`redirectTo` must be set as response locals '
                            + 'property before calling `sendResponse` '
                            + 'middleware');
        }

        if (!Type.is(userUseTestAccount, Boolean)) {
            throw new Error('`useTestAccount` must be set as response locals '
                            + 'property before calling `sendResponse` '
                            + 'middleware');
        }

        if (usedFor === 'authorizeUnloggedUser'
            && !accessTokenToSend) {

            throw new Error('`accessTokenToSend` must be set as response locals '
                            + 'property before calling `sendResponse` '
                            + 'middleware');
        }

        resp = {
            step: 'redirect',
            // Given by `genUrlToRedirectUserTo` middleware
            // contains url with `?code=` or `#access_token=`
            redirectTo: redirectTo,
            // To display in desktop app endpoint
            clientName: client.name,
            // To save and delete test account cookie
            clientID: client.id
        };

        // Set this in order to save user id in cookie
        // to re-use the same user on each test
        // and link user with future registration
        if (userUseTestAccount) {
            resp.useTestAccount = true;
            resp.userID = res.locals.user.id;
        } else {
            setDeleteTestAccountCookieResp(client, resp);
        }

        if (usedFor === 'authorizeUnloggedUser') {
            resp.accessToken = accessTokenToSend;
        }

        res.send(resp);
    };
};