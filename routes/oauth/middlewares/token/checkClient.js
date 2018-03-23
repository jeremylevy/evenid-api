var validator = require('validator');
var async = require('async');

var config = require('../../../../config');

var db = require('../../../../models');

module.exports = function (req, res, next) {
    var resp = res.locals.resp;
    var sendRes = res.locals.sendRes;

    if (!resp) {
        throw new Error('`resp` must be set as response locals '
                        + 'property before calling `checkClient` '
                        + 'middleware');
    }

    if (!sendRes) {
        throw new Error('`sendRes` must be set as response locals '
                        + 'property before calling `checkClient` '
                        + 'middleware');
    }

    var grantType = validator.trim(req.body.grant_type);
    
    var authorizationHeader = validator.trim(req.get('authorization'));

    // ^(client_id|API client_id):(client_secret)?$
    // Client secret depends on redirection uri
    var clientCredentialsPattern = '^(' + config.EVENID_MONGODB.OBJECT_ID_PATTERN 
                                        + '|' 
                                        + config.EVENID_APP.CLIENT_ID 
                                    + '):(' 
                                    + config.EVENID_OAUTH.PATTERNS.CLIENT_SECRETS 
                                    + ')?$';
    var clientCredentialsReg = new RegExp(clientCredentialsPattern);

    // Client ID and client secret may
    // also be sent through HTTP POST method
    var clientID = validator.trim(req.body.client_id);
    var clientSecret = validator.trim(req.body.client_secret);

    var isAppClient = false;

    var sendInvalidClientRes = function () {
        resp.error = 'invalid_client';
        resp.statusCode = 401;

        return sendRes();
    };

    /* Optional client secret is managed in 
       client credential regex above */

    // Client credentials sent through `Authorization` header
    if (authorizationHeader) {
        // Check Authorization header format
        if (!authorizationHeader.match(/^Basic [^\s]+$/i)) {
            return sendInvalidClientRes();
        }

        // Get client credentials by removing `Basic ` part
        authorizationHeader = authorizationHeader.split(' ')[1];

        // Check that client credentials are base64 encoded
        if (!validator.isBase64(authorizationHeader)) {
            return sendInvalidClientRes();
        }

        // Decode client credentials
        authorizationHeader = new Buffer(authorizationHeader, 'base64').toString('utf8');

        // Check that client credentials follow `client_id:(client_secret)?` pattern
        if (!authorizationHeader.match(clientCredentialsReg)) {
            return sendInvalidClientRes();
        }

        // authorizationHeader[0]: client_id
        // authorizationHeader[1]: client_secret
        authorizationHeader = authorizationHeader.split(':');

        clientID = authorizationHeader[0];
        clientSecret = authorizationHeader[1];
    } else { // Client credentials sent through HTTP POST
        
        if (!(clientID + ':' + clientSecret).match(clientCredentialsReg)) {
            return sendInvalidClientRes();
        }
    }

    isAppClient = (clientID === config.EVENID_APP.CLIENT_ID
                   && clientSecret === config.EVENID_APP.CLIENT_SECRET);

    // Mock client var because app client doesn't exist in DB
    if (isAppClient) {
        res.locals.client = 'app';
        res.locals.clientSecretWasUsed = true;     
    } else if (clientID === config.EVENID_APP.CLIENT_ID) {
        // Invalid app client secret
        return sendInvalidClientRes();
    }

    // `client_credentials` and `password` 
    // grant type only authorized for APP
    if (config.EVENID_OAUTH.APP_ONLY_GRANT_TYPES.indexOf(grantType) !== -1
        && !isAppClient
        // `authorization_code` only available 
        // for registered clients
        || config.EVENID_OAUTH.CLIENTS_ONLY_GRANT_TYPES.indexOf(grantType) !== -1
            && isAppClient) {

        resp.error = 'unauthorized_client';

        return sendRes();
    }

    if (['authorization_code', 'refresh_token'].indexOf(grantType) !== -1
        // `refresh_token` grant type can be used by
        // app and oauth clients
        && !isAppClient) {
        
        async.auto({
            getClient: function (cb) {
                var findConditions = {
                    client_id: clientID
                };

                if (clientSecret) {
                    findConditions.client_secret = clientSecret;
                }

                db.models.OauthClient.findOne(findConditions, '_id', function (err, client) {
                    var invalidClientError = new Error();

                    if (err) {
                        return cb(err);
                    }

                    invalidClientError.name = 'invalid_client';

                    if (!client) {
                        return cb(invalidClientError);
                    }

                    // Give access to client in next middlewares
                    res.locals.client = client;
                    res.locals.clientSecretWasUsed = !!clientSecret;

                    cb(null, client);
                });
            }
        }, function (err, results) {
            if (err) {
                if (err.name === 'invalid_client') {
                    return sendInvalidClientRes();
                }

                return next(err);
            }

            next();
        });

        return;
    }

    // `client_credentials`, `password` 
    // or 'refresh_token' grant type
    // App only
    next();
};