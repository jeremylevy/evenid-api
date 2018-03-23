var checkScope = require('../middlewares/checkScope');

module.exports = function (app, express) {
    app.get('/oauth/authorize',
            checkScope('unauthenticated_app').bind({
                name: 'oauthAuthorize'
            }), function (req, res, next) {
        
        res.send({
            step: 'credentials',
            // You can access `flow` directly from querystring
            // because it was validated on `checkQueryString` middleware
            flow: req.query.flow,
            client: res.locals.clientToSend,
            // If scope contains only email, submit button
            // text will be `Sign on` otherwise `Next`
            scope: res.locals.client.redirection_uris[0].scope,
            // Used to display `I just want to test` 
            // or `I just want to test this app` test
            // on use test account button
            installedApp: !res.locals.client.redirection_uris[0].needs_client_secret
        }); 
    });
};