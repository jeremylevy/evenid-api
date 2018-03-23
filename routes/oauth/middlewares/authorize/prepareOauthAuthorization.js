var async = require('async');
var Type = require('type-of-is');

var findUserAuthorizationForClient = require('../../../../models/actions/findUserAuthorizationForClient');

module.exports = function (req, res, next) {
    var accessToken = res.locals.accessToken;
    
    var client = res.locals.client;
    var user = res.locals.user;
    
    var useTestAccount = res.locals.useTestAccount;
    var userAuthorizationForClient = res.locals.userAuthorizationForClient;

    // Doesn't assert that access token is set
    // because when test account is used, 
    // it is not set.

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `prepareOauthAuthorization` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `prepareOauthAuthorization` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `prepareOauthAuthorization` '
                        + 'middleware');
    }

    var redirectionURI = client.redirection_uris[0];
    var currentScope = redirectionURI.scope;

    var oauthAuthorization = {
        issued_to: {
            client: client._id
        },

        issued_for: user._id,
        type: redirectionURI.response_type === 'code' 
            ? 'authorization_code' 
            : 'token',
        
        scope: redirectionURI.scope,
        scope_flags: redirectionURI.scope_flags,

        needs_client_secret: redirectionURI.needs_client_secret,
        
        user: {
            addresses: []
        }
    };
    var authorizedEntities = {
        emails: [],
        unknown_phone_numbers: [],
        mobile_phone_numbers: [],
        landline_phone_numbers: [],
        addresses: [],
        use_test_account: useTestAccount
    };

    var callNextMiddleware = function (oauthAuthorization, authorizedEntities, next) {
        res.locals.oauthAuthorization = oauthAuthorization;
        res.locals.authorizedEntities = authorizedEntities;

        next();
    };

    if (useTestAccount) {
        return callNextMiddleware(oauthAuthorization, authorizedEntities, next);
    }

    if (currentScope.indexOf('emails') !== -1
        // User has implicitly given access to his email during
        // login on client form. Add it to the oauthAuthorization...
        && accessToken.logged_by_client
        && accessToken.logged_by_client.toString() === client.id) {

        authorizedEntities.emails.push(accessToken.logged_with_email.toString());
    }

    if (currentScope.indexOf('addresses') !== -1) {
        authorizedEntities.addresses = user.addresses.toObject({
            depopulate: true
        });
    }

    callNextMiddleware(oauthAuthorization, authorizedEntities, next);
};