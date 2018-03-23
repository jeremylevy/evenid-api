module.exports = function (req, res, next) {
    var client = res.locals.client;
    var userAuthorizationForClient = res.locals.userAuthorizationForClient;
    var accessTokenToSend = res.locals.accessTokenToSend;
    
    var response = {};

    if (!client) {
        throw new Error('`client` must be set as response locals ' 
                        + 'property before calling `correctUserWithFlowMismatch` ' 
                        + 'middleware');
    }

    if (!userAuthorizationForClient) {
        throw new Error('`userAuthorizationForClient` must be set as response locals '
                        + 'property before calling `correctUserWithFlowMismatch` '
                        + 'middleware');
    }
    
    // Registered user try to register once again
    if ((userAuthorizationForClient.scope.length
         && req.query.flow === 'registration')
         // User try to log in without being registered
        || (!userAuthorizationForClient.scope.length
            && req.query.flow === 'login')) {

        response = {
            step: req.query.flow === 'registration' 
                ? 'redirect_to_login_flow' 
                : 'redirect_to_registration_flow',
            clientName: client.name
        };

        // During POST request on login or registration form.
        // Same reply than during Oauth login. Ease the process for app.
        if (accessTokenToSend) {
            response.accessToken = accessTokenToSend;
        }

        res.send(response);

        return;
    }

    next();
};