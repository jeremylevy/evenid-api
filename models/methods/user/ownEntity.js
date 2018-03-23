var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../config');

var areValidObjectIDs = require('../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (fieldToSeekInto, ID) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');

    assert.ok(Type.is(fieldToSeekInto, String),
              'argument `fieldToSeekInto` must be a string');

    assert.ok(fieldToSeekInto.length > 0,
              'argument `fieldToSeekInto` must be a non-empty string');

    assert.ok(areValidObjectIDs([ID]),
              'argument `ID` must be an ObjectID');

    var user = this;
    var field = null;

    // Passed field can contains multiple level aka: `developer.client`
    fieldToSeekInto = fieldToSeekInto.split('.');

    for (var i = 0, j = fieldToSeekInto.length; i < j; ++i) {
        if (!field) { // First object
            field = user[fieldToSeekInto[i]];
            continue;
        }

        // Object of object
        field = field[fieldToSeekInto[i]];
    }

    assert.ok(field 
              && Type.is(field.toObject(), Array));

    field = field.toObject({
        // Make sure we have an array of IDs
        depopulate: true
    }).map(function (val){
        // Convert Object IDs to string
        return val.toString();
    });

    // Make sure we compare string
    if (!Type.is(ID, String)) {
        ID = ID.toString();
    }

    return field.indexOf(ID) !== -1;
};