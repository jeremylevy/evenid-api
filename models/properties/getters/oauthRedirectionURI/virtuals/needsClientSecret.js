var assert = require('assert');
var Type = require('type-of-is');

var url = require('url');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function () {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `OauthRedirectionURI` document');

    var oauthRedirectionURI = this;
    var parsedURI = null;

    if (!Type.is(oauthRedirectionURI.uri, String)) {
        return false;
    }

    parsedURI = url.parse(oauthRedirectionURI.uri);

    return ['http:', 'https:'].indexOf(parsedURI.protocol) !== -1 
        && parsedURI.hostname !== 'localhost';
};