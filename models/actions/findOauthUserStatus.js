var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (clientID, userID, cb) {
    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        findOauthUserStatus: function (cb) {
            db.models.OauthUserStatus.findOne({
                client: clientID,
                user: userID
            }, function (err, oauthUserStatus) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserStatus);
            });
        }
    }, function (err, results) {
        var oauthUserStatus = results && results.findOauthUserStatus;

        if (err) {
            return cb(err);
        }

        cb(null, oauthUserStatus);
    });
};