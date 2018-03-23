var assert = require('assert');

var config = require('../../../../../config');

var createHash = require('../../../../../libs/createHash');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function () {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');

    var user = this;
    var email = user.email;
    var hash = null;

    if (!email) {
        return undefined;
    }

    hash = createHash('md5', email.trim().toLowerCase());

    // We have chosen to not implement Gravatar
    // because its to buggy to use with URL and size
    return config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
            + '/users/profil-photos/default';
};