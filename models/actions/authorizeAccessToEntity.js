var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../');

var ServerError = require('../../errors/types/ServerError');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (userAuthEntityName, entityName, 
                           entityID, clientIDs, userID, cb) {

    assert.ok(config.EVENID_OAUTH
                    .PLURAL_SCOPE
                    .indexOf(userAuthEntityName) !== -1,
              'argument `userAuthEntityName` is invalid');

    assert.ok(config.EVENID_OAUTH
                    .VALID_ENTITY_ID_TYPES
                    .indexOf(entityName) !== -1,
              'argument `entityName` is invalid');

    assert.ok(areValidObjectIDs([entityID]),
            'argument `entityID` must be an ObjectID');

    assert.ok(areValidObjectIDs(clientIDs),
            'argument `clientIDs` must be an ObjectID');

    assert.ok(areValidObjectIDs([userID]),
            'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    async.auto({
        addToUserAuth: function (cb) {
            var update = {
                $push: {}
            };

            update.$push['entities.' + userAuthEntityName] = entityID;

            db.models.UserAuthorization.update({
                user: userID,
                client: {
                    $in: clientIDs
                },
            }, update, {
                // Multiple user authorizations
                // may be updated
                multi: clientIDs.length > 1
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }
                
                cb(null);
            });
        },

        insertOauthEntitiesID: ['addToUserAuth', function (cb, results) {
            var fns = [];
            var insertErrors = [];

            clientIDs.forEach(function (clientID) {
                fns.push(function (cb) {
                    db.models.OauthEntityID.create({
                        user: userID,
                        client: clientID,
                        real_id: entityID,
                        fake_id: mongoose.Types.ObjectId(),
                        entities: [entityName]
                    }, function (err, oauthEntityID) {
                        // `async.parallel` call main 
                        // callback for each errors. Avoid it.
                        if (err) {
                            insertErrors.push(err);
                            
                            return cb(null);
                        }

                        cb(null, oauthEntityID);
                    });
                });
            });

            async.parallel(fns, function (err, results) {
                // Unmanaged errors. The error middleware 
                // will responds with `server_error`.
                if (insertErrors.length) {
                    return cb(new ServerError(insertErrors));
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