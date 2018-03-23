var assert = require('assert');
var Type = require('type-of-is');

var config = require('../config');

var areValidObjectIDs = require('../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// `authorizations` parameter is an array 
// of `UserAuthorization` instances
module.exports = function (authorizations, entity, entityID) {
    assert.ok(Type.is(authorizations, Array),
            'argument `authorizations` must be an array');

              // Singular scope (like first_name, gender...)
    assert.ok((config.EVENID_OAUTH.VALID_USER_SCOPE.indexOf(entity) !== -1 
               && !entityID)
                // or entity (emails, phone_numbers...)
                || (config.EVENID_OAUTH.VALID_AUTHORIZATION_ENTITIES.indexOf(entity) !== -1 
                    && entityID),
                'argument `entity` must be a user scope value or an authorized entity');

    assert.ok(!entityID || areValidObjectIDs([entityID]),
            'argument `entityID` must be an ObjectID');

    var authorization = null;

    for (var i = 0, j = authorizations.length; i < j; ++i) {
        authorization = authorizations[i];

        if (entityID) {
            // Convert entitie's ObjectIDs to string to compare
            // against `entityID` as string
            authorization.entities[entity] = authorization.entities[entity].map(function (ID) {
                return ID.toString();
            });
        }

        if ((!entityID && authorization.scope
                                       .indexOf(entity) !== -1)
            || (entityID && authorization.entities[entity]
                                         .indexOf(entityID.toString()) !== -1)) {
            
            return true;
        }
    }

    return false;
};