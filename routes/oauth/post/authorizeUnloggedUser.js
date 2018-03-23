var setDeleteTestAccountCookieResp = require('../callbacks/setDeleteTestAccountCookieResp');

var checkScope = require('../middlewares/checkScope');

var logOrRegisterUser = require('../middlewares/authorize/logOrRegisterUser');
var useTestAccount = require('../middlewares/authorize/useTestAccount');

var findFieldsToAuthorize = require('../middlewares/authorize/findFieldsToAuthorize');
var correctUserWithFlowMismatch = require('../middlewares/authorize/correctUserWithFlowMismatch');

var authorizeClientForUser = require('../middlewares/authorize/authorizeClientForUser')
                                    ('authorizeUnloggedUser');

module.exports = function (app, express) {
    app.post('/oauth/authorize',
             checkScope('unauthenticated_app').bind({
                name: 'oauthAuthorize'
             }),
             // Even if user uses test account 
             // being unregistered
             // we need to create an user.
             logOrRegisterUser,
             useTestAccount,
             findFieldsToAuthorize,
             // Unregistered users which try to log in.
             // Registered users which try to register once again.
             correctUserWithFlowMismatch,
             function (req, res, next) {
        
        var client = res.locals.client;
        var accessTokenToSend = res.locals.accessTokenToSend;
        var fieldsToShow = res.locals.fieldsToShow;
        var fieldsToAuthorize = res.locals.fieldsToAuthorize;
        var testAccountWasMergedWithUser = res.locals.testAccountWasMergedWithUser;

        var resp = {
            step: 'redirect',
            redirectTo: 'same',
            // Same reply than during login.
            // Ease the process for app
            accessToken: accessTokenToSend
        };

        if (testAccountWasMergedWithUser) {
            setDeleteTestAccountCookieResp(client, resp);
        }

        // User has already authorized client
        // so redirect it to client immediatly
        // by calling `authorizeClientForUser` middlewares
        if (!fieldsToShow.length 
            && !Object.keys(fieldsToAuthorize).length) {

            return next();
        }

        res.send(resp);
    }, authorizeClientForUser);
};