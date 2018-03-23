var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var validEntities = config.EVENID_OAUTH
                          .ENTITIES_READY_FOR_UPDATE;

module.exports = function (entityName) {
    assert.ok(validEntities.indexOf(entityName) !== -1,
            'argument `entityName` is invalid');

    return function (next) {
        assert.ok(areValidObjectIDs([this._id]),
                'context must be set as a Mongoose document');
        
        assert.ok(Type.is(next, Function),
                'argument `next` must be a function');
        
        var entity = this;

        entity._granted_authorizations = undefined;
        entity._oauth_entities_id = undefined;

        if (entityName === 'phone_numbers') {
            entity._old_phone_type = undefined;
        }
        
        next();
    };
};