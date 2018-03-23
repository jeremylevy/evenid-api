var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (condtions, userID, clientID, cb) {
    assert.ok(Type.is(condtions, Object),
            'argument `condtions` must be an object literal');

    assert.ok(areValidObjectIDs([userID]),
            'argument `userID` must be an ObjectID');

    assert.ok(areValidObjectIDs([clientID]),
            'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    var findConditions = {
        user: userID,
        client: clientID
    };

    Object.keys(condtions).forEach(function (condtion) {
        findConditions[condtion] = condtions[condtion];
    });

    db.models.OauthEntityID.find(findConditions,
                                 function (err, oauthEntitiesID) {
        
        if (err) {
            return cb(err);
        }

        if (!oauthEntitiesID) {
            return cb(null, []);
        }

        cb(null, oauthEntitiesID);
    });
};