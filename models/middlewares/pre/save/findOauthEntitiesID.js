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
var db = null;

// We need to get the "client 
// specific ID" of updated entity
// to set in the notification 
// sent to clients
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

        var clientsWhichHandleNotif = grantedAuthorizations.filter(function (authorization) {
            // Only clients which 
            // handle update notification
            return !!authorization.client.update_notification_handler;
        }).map(function (authorization) {
            // We just want client IDs
            return authorization.client.id;
        });

        if (!clientsWhichHandleNotif.length
            || (!modifiedFieldsForCurrentEntity.length 
                // During address remove 
                // we want to notify clients
                && eventName === 'save')) {

            entity._oauth_entities_id = [];
            
            return next();
        }

        // Avoid circular reference 
        // by requiring function directly in middleware.
        // Db load model
        // which requires db
        // which requires model.
        // TODO: Find a clever solution
        if (!db) {
            db = require('../../../index');
        }

        db.models.OauthEntityID.find({
            client: {
                $in: clientsWhichHandleNotif
            },
            user: userID
        }, function (err, oauthEntitiesID) {
            if (err) {
                return next(err);
            }

            entity._oauth_entities_id = oauthEntitiesID;

            next();
        });
    };
};