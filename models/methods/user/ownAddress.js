var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../config');

var areValidObjectIDs = require('../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var ownEntity = require('./ownEntity');

module.exports = function (addressID) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');
    
    assert.ok(areValidObjectIDs([addressID]),
              'argument `addressID` must be an ObjectID');

    return ownEntity.call(this, 'addresses', addressID);
};