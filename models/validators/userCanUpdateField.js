var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var areValidObjectIDs = require('./areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var clientsWantField = require('../../libs/clientsWantField');

var isEmpty = require('./isEmpty');

module.exports = function (field) {
    assert.ok(config.EVENID_OAUTH
                    .VALID_ENTITY_FIELDS
                    .USERS.indexOf(field) !== -1,
              'argument `field` is invalid');
    
    return function (fieldValue) {
        assert.ok(areValidObjectIDs([this._id]),
                  'context must be set as an `User` document');

        var user = this;
        var authorizations = this._granted_authorizations;
        
        var _clientsWantField = false;

        // On signup
        if (user.isNew) {
            return true;
        }

        // Check that `_granted_authorizations`
        // was set during update
        if (!user.isModified('_granted_authorizations') 
            || !Type.is(authorizations, Array)) {
            
            throw new Error('`_granted_authorizations` field must '
                            + 'be set on User document before update');
        }

        _clientsWantField = clientsWantField(authorizations, field);

        // Can update if client wants field 
        // and field is not empty
        // or client doesn't want field
        return _clientsWantField && !isEmpty(fieldValue) || !_clientsWantField;
    };
};