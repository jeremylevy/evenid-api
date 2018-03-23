var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (entity, entityID, userID, cb) {
    assert.ok(!entity || config.EVENID_OAUTH
                               .VALID_AUTHORIZATION_ENTITIES
                               .indexOf(entity) !== -1,
              'argument `entity` must be an authorized entity');

    assert.ok(!entityID || areValidObjectIDs([entityID]),
              'argument `entityID` must be an ObjectID');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var context = this;
    var usedToDisplayInViews = context.usedTo && context.usedTo === 'displayInViews';
    var usedToNotifyClients = context.usedTo && context.usedTo === 'notifyClients';

    var authorizationsQuery = {
        user: userID
    };
    var authorizations = null;

    if (entity && entityID) {
        authorizationsQuery['entities.' + entity] = entityID;
    }

    // If only entity was passed 
    // get authorizations where 
    // clients ask for this entity type
    if (entity && !entityID) {
        authorizationsQuery.scope = entity;
    }

    authorizations = db.models.UserAuthorization
                              .find(authorizationsQuery);

    if (usedToDisplayInViews) {
        authorizations.populate({
            path: 'client',
            select: '_id name'
        });
    }

    if (usedToNotifyClients) {
        authorizations.populate({
            path: 'client',
            select: '_id client_secret update_notification_handler'
        });
    }

    authorizations.exec(function (err, authorizations) {
        if (err) {
            return cb(err);
        }

        cb(null, authorizations);
    });
};