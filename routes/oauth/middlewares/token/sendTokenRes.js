var config = require('../../../../config');

module.exports = function (resp, res) {
    var context = this;
    // Used to send the access token trough url hash
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var statusCode = resp.statusCode || (resp.error ? 400 : 200);

    if (statusCode === 401) {
        res.set('WWW-Authenticate', 'Basic realm="API"');
    }

    // Don't include the status code in JSON object
    delete resp.statusCode;

    if (resp.access_token) {
        resp.expires_in = config.EVENID_OAUTH.VALIDITY_PERIODS.ACCESS_TOKENS;
        resp.token_type = 'Bearer';
    }

    // If error send the same resp than during login
    // easier to manage in app
    if (usedDuringOauthAuthorize && !resp.error) {
        return resp;
    }

    res.status(statusCode)
       .send(resp);
};