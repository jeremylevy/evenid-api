var Type = require('type-of-is');
var url = require('url');

module.exports = function (URI) {
    var parsedURI = {};

    // Don't use assert here because `URI` may contains
    // value passed through form by user
    if (!Type.is(URI, String)) {
        return false;
    }

    parsedURI = url.parse(URI);

    // According to RFC, the redirection endpoint URI 
    // MUST be an absolute URI and MUST NOT include a
    // fragment component.
    return !!(parsedURI.protocol && !parsedURI.hash);
};