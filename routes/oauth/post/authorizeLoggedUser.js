var checkScope = require('../middlewares/checkScope');

var checkUserCanUseTestAccount = require('../middlewares/authorize/checkUserCanUseTestAccount');
var useTestAccount = require('../middlewares/authorize/useTestAccount');

var findFieldsToAuthorize = require('../middlewares/authorize/findFieldsToAuthorize');
var correctUserWithFlowMismatch = require('../middlewares/authorize/correctUserWithFlowMismatch');

var authorizeClientForUser = require('../middlewares/authorize/authorizeClientForUser')
                                    ('authorizeLoggedUser');

module.exports = function (app, express) {
    app.post('/oauth/authorize',
             checkScope('app').bind({name: 'oauthAuthorize'}),
             checkUserCanUseTestAccount,
             // `findFieldsToAuthorize` is called here, 
             // not in `authorizeClientForUser` 
             // in order to set `res.locals.userAuthorizationForClient` 
             // for `correctUserWithFlowMismatch` middleware
             useTestAccount, findFieldsToAuthorize, 
             correctUserWithFlowMismatch, authorizeClientForUser);
};