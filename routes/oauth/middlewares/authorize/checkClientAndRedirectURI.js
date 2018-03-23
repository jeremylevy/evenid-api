var url = require('url');
var validator = require('validator');

var db = require('../../../../models');

var InvalidRequestError = require('../../../../errors/types/InvalidRequestError');

module.exports = function (req, res, next) {
    var context = this;
    var qs = req.query;

    if (context.name === 'userRecoverPassword') {
        // During oauth authorize client ID
        // was passed as hidden input to 
        // customize the email that will be sent.
        // Not used during oauth authorize.
        if (!validator.trim(req.body.client)) {
            return next();
        }

        qs = req.body.query;
    }

    var clientID = validator.trim(qs.client_id);
    var redirectURI = validator.trim(qs.redirect_uri);

    var errors = {};
    var client = null;

    var parsedRedirectURI = url.parse(redirectURI);
    var redirectURIMatch = {
        uri: redirectURI 
    };

    // Called multiple times during
    // oauth authorization
    if (res.locals.client) {
        return next();
    }

    client = db.models.OauthClient.findOne({
        client_id: clientID
    });

    // Port is stripped from host, in pre save 
    // middleware, when using localhost address 
    if (parsedRedirectURI.hostname === 'localhost' 
        && parsedRedirectURI.port) {

        parsedRedirectURI.host = parsedRedirectURI.host
                                                  .replace(':' + parsedRedirectURI.port, '');
         
        redirectURIMatch.uri = url.format(parsedRedirectURI);
    }

    // Trailing slashes are always removed 
    // in pre save middleware
    redirectURIMatch.uri = redirectURIMatch.uri
                                           .replace(new RegExp('/+$'), '');
    
    client.populate({
        path: 'redirection_uris',
        match: redirectURIMatch
    });

    client.exec(function (err, client) {
        if (err) {
            return next(err);
        }

        // Invalid `client_id` parameter
        if (!client) {
            errors.client_id = 'client_id parameter is invalid.';

            return next(new InvalidRequestError(errors));
        }

        // Invalid `redirect_uri` parameter
        if (!client.redirection_uris.length) {
            errors.redirect_uri = 'redirect_uri parameter is invalid.';

            return next(new InvalidRequestError(errors));
        }

        res.locals.client = client;

        next();
    });
};