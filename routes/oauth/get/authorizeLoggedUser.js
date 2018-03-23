var localesData = require('../../../locales/data');

var checkScope = require('../middlewares/checkScope');

var findFieldsToAuthorize = require('../middlewares/authorize/findFieldsToAuthorize');
var setUserToSend = require('../middlewares/authorize/setUserToSend');
var correctUserWithFlowMismatch = require('../middlewares/authorize/correctUserWithFlowMismatch');

module.exports = function (app, express) {
    app.get('/oauth/authorize',
            checkScope('app').bind({name: 'oauthAuthorize'}), 
            findFieldsToAuthorize, correctUserWithFlowMismatch,
            setUserToSend, function (req, res, next) {
        
        var client = res.locals.client;
        var clientToSend = res.locals.clientToSend;
        var accessToken = res.locals.accessToken;

        var currentLocale = req.i18n.getLocale();
        var fieldsToShow = res.locals.fieldsToShow;
        var fieldsToAuthorize = res.locals.fieldsToAuthorize;

        var userAuthorizationForClient = res.locals.userAuthorizationForClient;

        // User needs to authorize or fill some fields
        if (fieldsToShow.length 
            || Object.keys(fieldsToAuthorize).length) {

            res.send({
                step: 'authorizations',
                // You can access `flow` directly from querystring
                // because it was validated on `checkQueryString` middleware
                // Used in app to choose between `will be authorized to access to`
                // and `needs additional information`
                flow: req.query.flow,
                client: clientToSend,
                
                user: res.locals.userToSend,
                // Used to decide if we need to display the test account button
                userWasLoggedByClient: accessToken.logged_by_client 
                                    && accessToken.logged_by_client.toString() === client.id,
                
                months: localesData[currentLocale].months,
                territories: localesData[currentLocale].territories,
                nationalities: localesData[currentLocale].nationalities,
                timezones: localesData[currentLocale].timezones,
                
                fieldsToShow: fieldsToShow,
                fieldsToAuthorize: fieldsToAuthorize,
                
                // Used as helper in views to display
                // text in separator (ie: `and needs your address` or `Your address`...)
                hasUserFieldsToShow: res.locals.hasUserFieldsToShow,

                // Used to display `I just want to test` 
                // or `I just want to test this app` test
                // on use test account button
                installedApp: !res.locals.client.redirection_uris[0].needs_client_secret
            });

            return;
        }

        // User has already authorized client
        // Display `Continue as...`
        res.send({
            step: 'choose_account',
            // Same than above
            flow: req.query.flow,
            client: res.locals.clientToSend
        });
    });
};