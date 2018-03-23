var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var validEntities = config.EVENID_OAUTH
                          .ENTITIES_READY_FOR_UPDATE;

var validEventTypes = config.EVENID_OAUTH
                            .VALID_EVENT_TYPES_FOR_ENTITY;

// Avoid circular references.
// See below.
var findUserAuthorizations = null;
var findClientsWhichHaveNotGetEntity = null;

// Maybe used by User entity 
// and entities like Email, Address...
module.exports = function (entityName) {
    var context = this;
    var eventName = context.eventName || 'validate';

    assert.ok(validEntities.indexOf(entityName) !== -1,
              'argument `entityName` is invalid');

    assert.ok(validEventTypes.indexOf(eventName) !== -1,
              'argument `eventName` is invalid');
    
    return function (next) {
        assert.ok(areValidObjectIDs([this._id]),
                  'context must be set as a Mongoose document');
        
        assert.ok(Type.is(next, Function),
                  'argument `next` must be a function');

        var entity = this;
        var entityID = null;
        var userID = null;

        // Make sure granted authorizations were
        // set even for newly created entity
        entity._granted_authorizations = [];

        // First creation?
        if (entity.isNew
            // We don't want that all clients which 
            // have asked for this entity type 
            // will be authorized
            && config.EVENID_OAUTH
                     .ENTITIES_READY_FOR_NEW_CLIENTS
                     .indexOf(entityName) === -1) {
            
            return next();
        }

        // Not used by User entity
        if (entityName !== 'users') {
            entityID = this._id;
            userID = this.user;

            assert.ok(areValidObjectIDs([userID]),
                     'entity must contains an `user` property');

            // We want all clients which 
            // have asked for this entity type
            if (entity.isNew) {
                entityID = null;
            }
        } else {
            userID = this._id;
        }

        // Avoid circular reference 
        // by requiring function directly in middleware.
        // Db load model
        // which requires `findUserAuthorizations`
        // which requires db.
        // TODO: Find a clever solution
        if (!findUserAuthorizations) {
            findUserAuthorizations = require('../../../actions/findUserAuthorizations');
            findClientsWhichHaveNotGetEntity = require('../../../actions/findClientsWhichHaveNotGetEntity');
        }

        // Get all clients which have 
        // asked for this entity/fields
        findUserAuthorizations.call({
            usedTo: 'notifyClients'
        }, entityName === 'users' ? null : entityName, 
        entityID, userID, function (err, authorizations) {
            
            if (err) {
                return next(err);
            }

            entity._granted_authorizations = authorizations;

            if (eventName === 'remove') {
                // Only clients which have retrieved the 
                // deleted entity by calling the GET user method 
                // needs to be notified
                findClientsWhichHaveNotGetEntity(userID, entityName, entityID, function (err, clients) {
                    if (err) {
                        return next(err);
                    }
                    
                    entity._granted_authorizations = entity._granted_authorizations.filter(function (authorization) {
                        return clients.indexOf(authorization.client._id.toString()) === -1;
                    });

                    // Same than below
                    entity.markModified('_granted_authorizations');

                    next();
                });

                return;
            }

            // `userCanUpdateField` validator check 
            // that `entity._granted_authorizations` is modified.
            // If `entity._granted_authorizations` is an 
            // empty array before calling `findUserAuthorizations`
            // and `authorizations` is empty, `entity._granted_authorizations`
            // will not be set as modified.
            entity.markModified('_granted_authorizations');

            next();
        });
    };
};