var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../config');

var areValidObjectIDs = require('../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var ownEntity = require('./ownEntity');

module.exports = function (phoneNumberID) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');
    
    assert.ok(areValidObjectIDs([phoneNumberID]),
              'argument `phoneNumberID` must be an ObjectID');

    return ownEntity.call(this, 'phone_numbers', phoneNumberID);
};