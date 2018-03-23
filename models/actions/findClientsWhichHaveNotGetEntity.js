var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

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
        findClients: function (cb) {
            db.models.OauthUserStatus.find(findConditions, function (err, oauthUserStatus) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserStatus.map(function (userStatus) {
                    return userStatus.client.toString();
                }));
            });
        }
    }, function (err, results) {
        var clientIDs = results && results.findClients;

        if (err) {
            return cb(err);
        }
        
        cb(null, clientIDs);
    });
};