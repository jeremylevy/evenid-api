var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (userID, clientID, cb) {
    assert.ok(areValidObjectIDs([userID]),
            'argument `userID` must be an ObjectID');

    assert.ok(areValidObjectIDs([clientID]),
            'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    db.models.UserAuthorization.findOne({
        user: userID,
        client: clientID   
    }, function (err, userAuthorization) {
        if (err) {
            return cb(err);
        }

        // Easier for caller to return empty user authorization than null
        cb(null, userAuthorization || new db.models.UserAuthorization());
    });
};