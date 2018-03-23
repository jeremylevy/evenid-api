var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

var validEntities = config.EVENID_OAUTH
                          .ENTITIES_READY_FOR_NEW_CLIENTS;

// Avoid circular references.
// See below.
var authorizeAccessToEntity = null;

module.exports = function (entityName) {
    assert.ok(validEntities.indexOf(entityName) !== -1,
              'argument `entityName` is invalid');

    return function (next) {
        assert.ok(areValidObjectIDs([this._id]),
                  'context must be set as a Mongoose document');
        
        assert.ok(Type.is(next, Function),
                  'argument `next` must be a function');
        
        var entity = this;
        var oauthEntityIDName = entityName;

        var userID = entity.user;

        assert.ok(areValidObjectIDs([userID]),
                  'entity must contains an `user` property');

        // Contain all clients which 
        // have asked for this entity type
        var grantedAuthorizations = entity._granted_authorizations;
        
        assert.ok(Type.is(grantedAuthorizations, Array),
                  'entity must contains a `_granted_authorizations` property');

        // We just want client IDs
        var clientsWhichWantEntityType = grantedAuthorizations.map(function (authorization) {
            return authorization.client.id;
        });

        if (entityName === 'phone_numbers') {
            oauthEntityIDName = entity.phone_type + '_phone_numbers';
        }

        // During update?
        if (!entity.isNew
            || !clientsWhichWantEntityType.length) {
            
            return next();
        }

        // Avoid circular reference 
        // by requiring function directly in middleware.
        // Db load model
        // which requires db
        // which requires model.
        // TODO: Find a clever solution
        if (!authorizeAccessToEntity) {
            authorizeAccessToEntity = require('../../../actions/authorizeAccessToEntity');
        }
        
        authorizeAccessToEntity(entityName,
                                oauthEntityIDName, 
                                entity.id,
                                clientsWhichWantEntityType, 
                                userID, function (err) {

            if (err) {
                return next(err);
            }

            next();
        });
    };
};