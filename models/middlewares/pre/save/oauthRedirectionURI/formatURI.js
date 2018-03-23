var assert = require('assert');
var url = require('url');
var Type = require('type-of-is');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (next) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `OauthRedirectionURI` document');
    
    assert.ok(Type.is(next, Function),
              'argument `next` must be a function');
    
    var oauthRedirectionURI = this;
    var parsedRedirectionURI = url.parse(oauthRedirectionURI.uri);

    if (!oauthRedirectionURI.isModified('uri')) {
        return next();
    }

    // Always remove port for localhost addresses
    if (parsedRedirectionURI.hostname === 'localhost' 
        && parsedRedirectionURI.port) {

        parsedRedirectionURI.host = parsedRedirectionURI.host.replace(':' + parsedRedirectionURI.port, '');
         
        oauthRedirectionURI.uri = url.format(parsedRedirectionURI);
    }

    // Always remove trailing slashes
    oauthRedirectionURI.uri = oauthRedirectionURI.uri.replace(new RegExp('/+$'), '');

    next();
};