var assert = require('assert');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (phoneType) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as a `PhoneNumber` document');

    var phoneNumber = this;

    // Not modified
    if (phoneNumber.phone_type === phoneType) {
        return phoneType;
    }

    // Make sure we keep original value
    if (!phoneNumber._old_phone_type) {
        phoneNumber._old_phone_type = phoneNumber.phone_type;
    }

    return phoneType;
};