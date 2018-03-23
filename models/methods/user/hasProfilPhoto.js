var assert = require('assert');

var config = require('../../../config');

var areValidObjectIDs = require('../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);
var isValidUploadHash = require('../../validators/isValidUploadHash');

module.exports = function () {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');
    
    var user = this;

    return isValidUploadHash(user.profil_photo);
};