var assert = require('assert');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var isValidUploadHash = require('../../../validators/isValidUploadHash');

module.exports = function (logoHash) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `OauthClient` document');

    assert.ok(!logoHash || isValidUploadHash(logoHash),
            'argument `logoHash` must be a valid upload hash');

    var oauthClient = this;

    if (!logoHash) {
        return undefined;
    }

    return config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS
            + '/clients/logos/' 
            + logoHash;
};