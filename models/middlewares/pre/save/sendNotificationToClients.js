var assert = require('assert');
var Type = require('type-of-is');

var AWS = require('aws-sdk');
var async = require('async');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

var ServerError = require('../../../../errors/types/ServerError');

var validEntities = config.EVENID_OAUTH
                          .ENTITIES_READY_FOR_UPDATE;

var validEventTypes = config.EVENID_OAUTH
                            .VALID_EVENT_TYPES_FOR_ENTITY;

// Avoid circular references.
// See below.
var updateOauthNotification = null;

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

        var sqs = new AWS.SQS({
            accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
            secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
            region: config.EVENID_AWS.SQS.REGION,
            sslEnabled: true
        });
        
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
            // handle update notification
            return !!authorization.client.update_notification_handler;
        });

        var oauthEntitiesID = entity._oauth_entities_id;

        assert.ok(Type.is(oauthEntitiesID, Array),
                  'entity must contains an `_oauth_entities_id` property');
        
        var updateOauthNotificationFns = [];
        var updateOauthNotificationErrs = [];
        
        var oauthNotifications = [];
        var addOauthNotification = function (authorization, notification) {
            oauthNotifications.push({
                client_id: authorization.client.id,
                // to be able to retrieve 
                // oauth notification
                user_id: getFakeIDFor(authorization.client.id, userID)
            });

            updateOauthNotificationFns.push(function (cb) {
                updateOauthNotification(authorization.client.id,
                                        // Oauth notification are client specific,
                                        // we don't want them to stay between two registrations
                                        // of the same user on the same client 
                                        getFakeIDFor(authorization.client.id, userID), {
                    // Will be pushed. See method.
                    pending_notifications: [{
                        notification: JSON.stringify({
                            client_secret: authorization.client.client_secret,
                            handler_url: authorization.client.update_notification_handler,
                            notification: notification
                        })
                    }]
                }, function (err) {
                    // We don't want main callback 
                    // to be called for each error
                    if (err) {
                        updateOauthNotificationErrs.push(err);
                    }

                    cb(null);
                });
            });
        };

        var getFakeIDFor = function (clientID, realID) {
            var fakeID = null;

            oauthEntitiesID.forEach(function (oauthEntityID) {
                if (oauthEntityID.client.toString() !== clientID.toString()
                    || oauthEntityID.real_id.toString() !== realID.toString()) {

                    return;
                }

                fakeID = oauthEntityID.fake_id;
            });

            assert.ok(!!fakeID, 'Fake ID must be set.');

            return fakeID;
        };

        // First creation?
        if (entity.isNew
            // Only addresses are 
            // shared between clients
            && config.EVENID_OAUTH
                     .ENTITIES_READY_FOR_NEW_CLIENTS
                     .indexOf(entityName) === -1) {
            
            return next();
        }

        if (!grantedAuthorizations.length
            || (!modifiedFieldsForCurrentEntity.length
                // During address remove 
                // we want to notify clients
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
        // which requires `sendNotificationToClients`
        // which requires db.
        // TODO: Find a clever solution
        if (!updateOauthNotification) {
            updateOauthNotification = require('../../../actions/updateOauthNotification');
        }

        // For each updated fields, find 
        // which clients have asked for it
        if (entityName === 'users') {
            // For each clients which have
            // been authorized by user
            grantedAuthorizations.forEach(function (authorization) {
                var notification = {};

                notification = {
                    event_type: 'user_did_update_personal_information',
                    user_id: getFakeIDFor(authorization.client.id, userID),
                    updated_fields: []
                };

                // For each updated fields
                modifiedFieldsForCurrentEntity.forEach(function (modifiedField) {
                    // Make sure client have asked 
                    // for the updated field
                    // (Scope match user fields)
                    if (authorization.scope.indexOf(modifiedField) === -1) {
                        return;
                    }

                    notification.updated_fields.push(modifiedField);

                    notification[modifiedField] = entity[modifiedField];
                });

                // Client does not have 
                // asked for updated fields
                if (!notification.updated_fields.length) {
                    return;
                }

                addOauthNotification(authorization, notification);
            });
        } else {

            // `_granted_authorizations` only contains clients 
            // which have asked for this entity (or entity type if new).
            // See `populateGrantedAuthorizations` middleware for more.
            // For each clients which have asked for this entity.
            grantedAuthorizations.forEach(function (authorization) {
                var notification = {};
                var fieldsToSetInNotif = modifiedFieldsForCurrentEntity;

                // All fields needs to be set
                // not only the ones which were
                // updated
                if (entity.isNew) {
                    fieldsToSetInNotif = config.EVENID_OAUTH
                                               .VALID_ENTITY_FIELDS[entityName.toUpperCase()];
                }

                notification = {
                    event_type: 'user_did_update_personal_information',
                    user_id: getFakeIDFor(authorization.client.id, userID),
                    updated_fields: [entityName],
                };

                notification[entityName] = [{
                    id: getFakeIDFor(authorization.client.id, entity.id),
                    status: eventName === 'save' ? (entity.isNew 
                        ? 'new' 
                        : 'updated') : 'deleted',
                    updated_fields: entity.isNew 
                        ? [] 
                        : modifiedFieldsForCurrentEntity
                }];

                fieldsToSetInNotif.forEach(function (fieldToSetInNotif) {
                    // `first_for` field doesn't exist in address.
                    // Bound to oauth authorization depending on selected address 
                    // for shipping, billing or raw address.
                    if (entityName === 'addresses'
                        && fieldToSetInNotif === 'first_for') {

                        if (entity.isNew) {
                            notification[entityName][0][fieldToSetInNotif] = [];
                        } else {
                            // `first_for` field cannot be updated by user.
                            // Never set it in notification that was sent to clients.
                        }

                        return;
                    }
                    
                    // Field may be optional so make 
                    // sur we send an empty string
                    notification[entityName][0][fieldToSetInNotif] = entity[fieldToSetInNotif] || '';
                });

                addOauthNotification(authorization, notification);
            });
        }

        if (oauthNotifications.length > 0) {
            async.parallel(updateOauthNotificationFns, function () {
                if (updateOauthNotificationErrs.length) {
                    return next(new ServerError(updateOauthNotificationErrs));
                }

                // Wait until oauth notifications are added
                // given that worker need them
                sqs.sendMessage({
                    MessageBody: JSON.stringify(oauthNotifications),
                    QueueUrl: config.EVENID_AWS.SQS.QUEUE_URL
                }, function (err, data) {
                    if (err) {
                        return next(err);
                    }

                    next();
                });
            });

            return;
        }

        next();
    };
};