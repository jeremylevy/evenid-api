var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);
var isEmpty = require('../../../../validators/isEmpty');

// Update from empty string to `undefined`.
// Since Mongoose version 4.0, if you set a 
// `non-undefined` field to `undefined`, validators 
// will no longer be run. Given that we need to check
// if user could remove field asked by client we must 
// set field to an empty string instead of `undefined`, run
// the validators, then set it to `undefined`.
module.exports = function (next) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `User` document');
    
    assert.ok(Type.is(next, Function),
            'argument `next` must be a function');
    
    var user = this;
    var modifiedFields = user.modifiedPaths()
                             .filter(function (field) {
        
        return config.EVENID_OAUTH
                     .VALID_ENTITY_FIELDS
                     .USERS.indexOf(field) !== -1;
    });

    if (!modifiedFields.length) {
        return next();
    }

    modifiedFields.forEach(function (modifiedField) {
        var userValue = user[modifiedField];

        if (!isEmpty(userValue)) {
            return;
        }

        user[modifiedField] = undefined;
    });

    next();
};