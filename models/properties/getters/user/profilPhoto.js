var assert = require('assert');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);
var isValidUploadHash = require('../../../validators/isValidUploadHash');

module.exports = function (profilPhotoHash) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `User` document');

    assert.ok(!profilPhotoHash || isValidUploadHash(profilPhotoHash),
            'argument `profilPhotoHash` must be a valid upload hash');

    var user = this;

    if (!profilPhotoHash) {
        return user.gravatar;
    }
        
    return config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
            + '/users/profil-photos/' 
            + profilPhotoHash;
};