var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

var validEntities = config.EVENID_OAUTH
                          .ENTITIES_READY_FOR_UPDATE;

var validEventTypes = config.EVENID_OAUTH
                            .VALID_EVENT_TYPES_FOR_ENTITY;

// Avoid circular references.
// See below.
var updateOauthUserStatus = null;

module.exports = function (entityName) {
    var context = this;
    var eventName = context.eventName || 'save';

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
        var userID = entityName === 'users' ? entity._id : entity.user;

        assert.ok(areValidObjectIDs([userID]),
                  'entity must contains an `user` property');
        
        // Make sure updated fields are fields 
        // that could be tracked by clients
        var modifiedFieldsForCurrentEntity = entity.modifiedPaths()
                                                   .filter(function (modifiedField) {
            return config.EVENID_OAUTH
                         .VALID_ENTITY_FIELDS[entityName.toUpperCase()]
                         .indexOf(modifiedField) !== -1;
        }).filter(function (modifiedField) {
            // Phone type may be set to `_old_phone_type` 
            // when unknown phone number was used.
            // See `assertPhoneTypeMayBeUpdated` middleware.
            return entityName !== 'phone_numbers'
                   || modifiedField !== 'phone_type'
                   || entity.phone_type !== entity._old_phone_type;
        });

        var grantedAuthorizations = entity._granted_authorizations;
        
        assert.ok(Type.is(grantedAuthorizations, Array),
                  'entity must contains a `_granted_authorizations` property');

        grantedAuthorizations = grantedAuthorizations.filter(function (authorization) {
            // Only clients which 
            // don't handle update 
            // notification
            return !authorization.client.update_notification_handler;
        });
        
        var clientsWhichNeedUserStatusUpdate = [];
        
        var update = {
            status: 'existing_user_after_update',
            updated_fields: []
        };

        // First creation?
        if (entity.isNew
            // We don't want that all clients which 
            // have asked for this entity type will
            // be authorized
            && config.EVENID_OAUTH
                     .ENTITIES_READY_FOR_NEW_CLIENTS
                     .indexOf(entityName) === -1) {
            
            return next();
        }

        if (!grantedAuthorizations.length
            || (!modifiedFieldsForCurrentEntity.length
                // During address remove 
                // we want to update oauth user status
                && eventName === 'save')) {

            return next();
        }

        // Just to be sure.
        if (eventName === 'remove'
            && modifiedFieldsForCurrentEntity.length) {

            modifiedFieldsForCurrentEntity = [];
        }

        // Avoid circular reference 
        // by requiring function directly in middleware.
        // Db load model
        // which requires `findUserAuthorizations`
        // which requires db.
        // TODO: Find a clever solution
        if (!updateOauthUserStatus) {
            updateOauthUserStatus = require('../../../actions/updateOauthUserStatus');
        }

        // For each updated fields, find which clients have asked for it
        if (entityName === 'users') { 
            // For each updated fields
            modifiedFieldsForCurrentEntity.forEach(function (modifiedField) {
                // We set all updated fields 
                // (not only the ones asked by client)
                // to not be forced to make
                // one update by client.
                // Filtered when getting user.
                update.updated_fields.push(modifiedField);

                // For each clients which have been authorized by user
                grantedAuthorizations.forEach(function (authorization) {
                    // Make sure client have asked for the updated field
                    // (Scope match user fields)
                    if (authorization.scope.indexOf(modifiedField) === -1) {
                        return;
                    }

                    // Client already needs user status update
                    if (clientsWhichNeedUserStatusUpdate.indexOf(authorization.client.id) !== -1) {
                        return;
                    }

                    clientsWhichNeedUserStatusUpdate.push(authorization.client.id);
                });
            });
        } else {
            // On user level
            update.updated_fields.push(entityName);

            // On entity level
            update['updated_' + entityName] = [{
                id: entity._id,
                status: eventName === 'save' 
                    ? (entity.isNew 
                       ? 'new' : 'updated') 
                    : 'deleted',
                updated_fields: entity.isNew 
                    ? [] 
                    : modifiedFieldsForCurrentEntity
            }];

            // `_granted_authorizations` only contains clients 
            // which have asked for this entity (or entity type if new).
            // See `populateGrantedAuthorizations` middleware for more.
            // For each clients which have asked for this entity.
            grantedAuthorizations.forEach(function (authorization) {
                clientsWhichNeedUserStatusUpdate.push(authorization.client.id);
            });
        }

        if (clientsWhichNeedUserStatusUpdate.length > 0) {
            updateOauthUserStatus(clientsWhichNeedUserStatusUpdate, 
                                  userID, 
                                  update, 
                                  function (err) {
                if (err) {
                    return next(err);
                }

                next();
            });

            return;
        }

        next();
    };
};