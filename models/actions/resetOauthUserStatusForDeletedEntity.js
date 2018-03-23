var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var ServerError = require('../../errors/types/ServerError');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var validEntities = config.EVENID_OAUTH
                          .ENTITIES_READY_FOR_UPDATE;

module.exports = function (userID, entityName, entityID, cb) {
    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(validEntities.indexOf(entityName) !== -1,
              'argument `entityName` is invalid');

    assert.ok(areValidObjectIDs([entityID]),
              'argument `entityID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var findConditions = {
        user: userID
    };

    findConditions['updated_' + entityName] = {
        $elemMatch: {
            id: entityID,
            status: 'new'
        }
    };

    async.auto({
        findOauthUserStatus: function (cb) {
            db.models.OauthUserStatus.find(findConditions, function (err, oauthUserStatus) {
                var oauthUserStatusToUpdate = [];
                var oauthUserStatusToReset = [];

                if (err) {
                    return cb(err);
                }
                
                oauthUserStatus.forEach(function (userStatus) {
                    var hasOtherUpdatedFields = false;
                    var hasOtherUpdatedEntity = false;

                    if (userStatus.updated_fields.length > 1) {
                        hasOtherUpdatedFields = true;
                    }

                    userStatus['updated_' + entityName].forEach(function (entity) {
                        if (entity.id.toString() === entityID.toString()) {
                            return;
                        }

                        hasOtherUpdatedEntity = true;
                    });

                    if (hasOtherUpdatedEntity || hasOtherUpdatedFields) {
                        oauthUserStatusToUpdate.push(userStatus);

                        return;
                    }

                    oauthUserStatusToReset.push(userStatus);
                });

                cb(null, {
                    toReset: oauthUserStatusToReset,
                    toUpdate: oauthUserStatusToUpdate
                });
            });
        },

        resetOauthUserStatus: ['findOauthUserStatus', function (cb, results) {
            var oauthUserStatus = results.findOauthUserStatus.toReset;
            var update = {
                status: 'existing_user',
                updated_fields: []
            };

            if (!oauthUserStatus.length) {
                return cb(null);
            }

            update['updated_' + entityName] = [];

            db.models.OauthUserStatus.update({
                _id: {
                    $in: oauthUserStatus.map(function (v) {
                        return v.id;
                    })
                }
            }, update, {
                multi: oauthUserStatus.length > 1
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        updateOauthUserStatus: ['findOauthUserStatus', function (cb, results) {
            var oauthUserStatus = results.findOauthUserStatus.toUpdate;
            var updates = [];
            var updateErrors = [];

            if (!oauthUserStatus.length) {
                return cb(null);
            }

            oauthUserStatus.forEach(function (userStatus) {
                var update = {
                    updated_fields: userStatus.updated_fields
                };

                // Remove deleted entity
                // from `updated_{entityName}`
                // field.
                update['updated_' + entityName] = userStatus['updated_' + entityName].filter(function (entity) {
                    return entity.id.toString() !== entityID.toString();
                });

                // If we don't have any updated entity
                // other than the one which was deleted.
                // Remove `entityName` from `updated_fields`
                // field.
                if (!update['updated_' + entityName].length) {
                    update.updated_fields = update.updated_fields.filter(function (field) {
                        return field !== entityName;
                    });
                }

                updates.push(function (cb) {
                    db.models.OauthUserStatus.update({
                        _id: userStatus.id
                    }, update, function (err, rawResponse) {
                        // We don't want the main 
                        // callback to be called for 
                        // each error
                        if (err) {
                            updateErrors.push(err);
                        }

                        cb(null);
                    });
                });
            });

            async.parallel(updates, function (err, results) {
                if (updateErrors.length) {
                    return cb(new ServerError(updateErrors));
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};