var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

module.exports = function (userID, clientID, type, cb) {
    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(config.EVENID_OAUTH
                    .VALID_EVENT_TYPES_FOR_USER
                    .indexOf(type) !== -1,
              'argument `type` is invalid');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var oauthUserEvent = {
        user: userID,
        client: clientID,
        type: type
    };

    var userOwnClientErr = new Error();

    userOwnClientErr.name = 'user_own_client';

    async.auto({
        assertUserDoesntOwnClient: function (cb) {
            db.models.User.findOne({
                _id: userID,
                'developer.clients': clientID
            }, function (err, user) {
                if (err) {
                    return cb(err);
                }

                if (user) {
                    return cb(userOwnClientErr);
                }

                cb(null);
            });
        },

        insertOauthUserEvent: ['assertUserDoesntOwnClient', function (cb) {
            db.models.OauthUserEvent.create(oauthUserEvent, function (err, oauthUserEvent) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserEvent);
            });
        }]
    }, function (err, results) {
        var oauthUserEvent = results && results.insertOauthUserEvent;

        if (err) {
            if (err.name === 'user_own_client') {
                return cb(null);
            }
            
            return cb(err);
        }

        cb(null, oauthUserEvent);
    });
};