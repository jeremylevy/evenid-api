var validator = require('validator');
var Type = require('type-of-is');

var config = require('../../../../config');

module.exports = function (req, res, next) {
    var resp = res.locals.resp;
    var sendRes = res.locals.sendRes;

    if (!resp) {
        throw new Error('`resp` must be set as response locals '
                        + 'property before calling `checkRequest` '
                        + 'middleware');
    }

    if (!sendRes) {
        throw new Error('`sendRes` must be set as response locals '
                        + 'property before calling `checkRequest` '
                        + 'middleware');
    }

    var grantType = validator.trim(req.body.grant_type);

    var code = validator.trim(req.body.code);

    var refreshToken = validator.trim(req.body.refresh_token);

    // Check request
    if (!grantType
        || (grantType === 'authorization_code' 
            && !code)
        || (grantType === 'password'
            // If user send login form with empty values
            // prefer to send `invalid_grant` error 
            // (ie: `Invalid credentials`)
            // than `invalid_request` error 
            // (ie: `This form contains invalid fields`)
            && (Type.is(req.body.username, undefined) 
                || Type.is(req.body.password, undefined)))
        || (grantType === 'refresh_token'
            && !refreshToken)) {

        resp.error = 'invalid_request';

        return sendRes();
    }

    // Check grant type
    if (!validator.isIn(grantType, 
                        config.EVENID_OAUTH.VALID_GRANT_TYPES)) {
        
        resp.error = 'unsupported_grant_type';

        return sendRes();
    }

    next();
};