var url = require('url');
var querystring = require('querystring');
var validator = require('validator');

var sendTokenRes = require('../token/sendTokenRes');

module.exports = function (req, res, next) {
    var oauthAuthorization = res.locals.oauthAuthorization;
    
    // Authorization codes are hashed in db,
    // send raw value to user
    var authorizationCode = res.locals.authorizationCodeToSetInURL;

    // Tokens are hashed in db,
    //  send raw value to user
    var accessToken = res.locals.accessTokenToSetInURL;

    // ID sent to clients are 'client specific'
    var userID = res.locals.userIDToSendToClient;
    var userStatus = res.locals.userStatus;

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `genURLToRedirectUserTo` '
                        + 'middleware');
    }

    if (oauthAuthorization.type === 'authorization_code' 
        && !authorizationCode) {

        throw new Error('`authorizationCodeToSetInURL` must be set as response locals '
                        + 'property before calling `genURLToRedirectUserTo` '
                        + 'middleware during `code` authorization type');        
    }

    if (oauthAuthorization.type === 'token' && !userID) {
        throw new Error('`userIDToSendToClient` must be set as response locals '
                        + 'property before calling `genURLToRedirectUserTo` '
                        + 'middleware during `token` authorization type');
    }

    if (oauthAuthorization.type === 'token' && !accessToken) {
        throw new Error('`accessToken` must be set as response locals '
                        + 'property before calling `genURLToRedirectUserTo` '
                        + 'middleware during `token` authorization type');
    }

    if (oauthAuthorization.type === 'token' && !userStatus) {
        throw new Error('`userStatus` must be set as response locals '
                        + 'property before calling `genURLToRedirectUserTo` '
                        + 'middleware during `token` authorization type');
    }

    var redirectURI = validator.trim(req.query.redirect_uri);
    var state = validator.trim(req.query.state);

    var parsedRedirectURI = url.parse(redirectURI);
    var redirectURIHasQS = !!parsedRedirectURI.search;

    var redirectTo = null;
    var redirectToQS = null;
    var redirectToEndPart = '';

    if (oauthAuthorization.type === 'authorization_code') {
        redirectToQS = {
            code: authorizationCode,
            state: state
        };

        // According to rfc the redirection endpoint URI MAY include a
        // query component which MUST be retained when adding
        // additional query parameters.
        if (!redirectURIHasQS) {
            redirectToEndPart += '?';
        } else if (parsedRedirectURI.search !== '?') {
            // Don't append `&` if redirect URI ends with `?`
            redirectToEndPart += '&';
        }

        redirectToEndPart += querystring.stringify(redirectToQS);

        redirectTo = redirectURI + redirectToEndPart;
    } else if (oauthAuthorization.type === 'token') {
        // Get exactly the same reply than during `authorization_code` authorization
        redirectToHash = sendTokenRes.call({
            name: 'oauthAuthorize'
        }, {
            access_token: accessToken,
            state: state,
            user_id: userID,
            user_status: userStatus
        }, res);

        redirectTo = redirectURI + '#' + querystring.stringify(redirectToHash);
    }

    res.locals.redirectTo = redirectTo;

    next();
};