var validator = require('validator');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);
var isValidOauthRedirectionURI = require('../../../../models/validators/isValidOauthRedirectionURI');

var InvalidRequestError = require('../../../../errors/types/InvalidRequestError');

module.exports = function (req, res, next) {
    var context = this;
    var usedDuringPasswordRecover = context.name === 'userRecoverPassword';

    var qs = req.query;

    if (usedDuringPasswordRecover) {
        // During oauth authorize client ID
        // was passed as hidden input to 
        // customize the email that will be sent.
        // ---
        // Not used during oauth authorize.
        if (!validator.trim(req.body.client)) {
            return next();
        }

        qs = req.body.query;
    }

    var clientID = qs.client_id;
    var redirectURI = qs.redirect_uri;

    var state = qs.state;
    var flow = qs.flow;

    var errors = {};
    var client = null;

    // Called multiple times during
    // oauth authorize flow.
    // `client` was set as locals in `checkClientAndRedirectURI`
    // middleware (called next).
    if (res.locals.client) {
        return next();
    }

    if (!areValidObjectIDs([clientID])) {
        if (clientID) {
            errors.client_id = 'The "client_id" parameter is invalid.';
        } else {
            errors.client_id = 'The "client_id" parameter must be set in querystring.';
        }
    }

    if (!isValidOauthRedirectionURI(redirectURI)) {
        if (redirectURI) {
            errors.redirect_uri = 'The "redirect_uri" parameter is invalid.';
        } else {
            errors.redirect_uri = 'The "redirect_uri" parameter must be set in querystring.';
        }
    }

    if (!state) {
        errors.state = 'The "state" parameter must be set in querystring.';
    }

    if (!flow) {
        errors.flow = 'The "flow" parameter must be set in querystring.';
        
    } else if (config.EVENID_OAUTH.VALID_FLOW.indexOf(flow) === -1
               || (usedDuringPasswordRecover 
                   && flow !== 'recover_password')) {
        
        errors.flow = 'The "flow" parameter is invalid.';
    }

    if (Object.keys(errors).length) {
        return next(new InvalidRequestError(errors));
    }

    next();
};