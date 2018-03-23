var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var isValidUploadHash = require('../../../validators/isValidUploadHash');
var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Logo was set as a URL 
// but we set only the logo hash.
// Returns value to be set.
module.exports = function (logoURL) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `OauthClient` document');

    // `logoURL` may be passed by user through form
    // so don't assert it here, let the validators do their job
    if (!Type.is(logoURL, String) || logoURL.length === 0) {
        return logoURL;
    }
    
    var logoURLParts = logoURL.split('/');
    var logoHash = null;

    logoURLParts.forEach(function (part) {
        if (!isValidUploadHash(part)) {
            return;
        }

        logoHash = part;
    });

    /* `logoURL` may be passed by user through form
        so don't assert that `logoHash` is an upload hash,
        let the validators do their job */

    return logoHash || logoURL;
};