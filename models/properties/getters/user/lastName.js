var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Upper first letter, lower the rest
// Don't use change-case module here,
// they don't take into account accented characters
module.exports = function (lastName) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `User` document');

    assert.ok(!lastName || Type.is(lastName, String),
              'argument `lastName` must be a string');

    if (!lastName) {
        return undefined;
    }

    return lastName.charAt(0).toUpperCase() 
            + lastName.slice(1).toLowerCase();
};