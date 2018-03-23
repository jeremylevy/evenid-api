var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Helper to get main email address
// when emails array is populated
module.exports = function () {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');
    
    var user = this;
    
    var emails = user.emails;
    var email = null;
    
    // Make sure user has emails
    if (!emails.length
        // Make sure emails array was populated
        || Type.is(emails[0].is_main_address, undefined)) {
        
        return undefined;
    }

    for (var i = 0, j = emails.length; i < j; ++i) {
        email = emails[i];

        if (email.is_main_address) {
            return email.address;
        }
    }

    return undefined;
};