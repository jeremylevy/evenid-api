var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var isValidUploadHash = require('../../../validators/isValidUploadHash');
var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Profil photo was set as a URL 
// but we only need the profil photo hash.
// Returns value to be set.
module.exports = function (profilPhotoURL) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `User` document');

    // `profilPhotoURL` may be passed 
    // by user through form
    // so don't assert it here, 
    // let the validators do their job
    if (!Type.is(profilPhotoURL, String) 
        || profilPhotoURL.length === 0) {
        
        return profilPhotoURL;
    }
    
    var profilPhotoURLParts = profilPhotoURL.split('/');
    var profilPhotoHash = null;

    profilPhotoURLParts.forEach(function (part) {
        if (!isValidUploadHash(part)) {
            return;
        }

        profilPhotoHash = part;
    });

    /* `profilPhotoURL` may be passed 
        by user through form so don't 
        assert that `profilPhotoHash` 
        is an upload hash, let the validators 
        do their job */

    return profilPhotoHash || profilPhotoURL;
};