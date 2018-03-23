var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (hookIDs, clientID, cb) {
    // `areValidObjectIDs` check for the 
    // `hookIDs` type and its emptiness
    assert.ok(areValidObjectIDs(hookIDs),
              'argument `hookIDs` must be an array of ObjectIDs');

    // Client ID is set when the developer remove one hook from client
    // and not set when client was deleted entirely
    assert.ok(!clientID || areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        // If developer removes hook 
        // for the `USER_DID_UPDATE_PERSONAL_INFORMATION` event  
        // client does not handle update notification anymore.
        // See below.
        findUpdateHook: function (cb) {
            // Called during client deletion
            if (!clientID) {
                return cb(null);
            }

            db.models.OauthHook.find({
                _id: {
                    $in: hookIDs
                },

                event_type: 'USER_DID_UPDATE_PERSONAL_INFORMATION'
            }, function (err, hooks) {
                if (err) {
                    return cb(err);
                }

                // Client cannot have more 
                // than one hook per event type
                cb(null, hooks[0]);
            });
        },

        removeHooks: ['findUpdateHook', function (cb) {
            db.models.OauthHook.remove({
                _id: {
                    $in: hookIDs
                }
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Pull hooks from client's hooks
        updateHooksForClient: ['removeHooks', function (cb, results) {
            var updateHook = results.findUpdateHook;
            var update = {
                $pull: { 
                    hooks: {
                        $in: hookIDs
                    }
                }
            };
            var options = {
                // To get updated client
                new: true
            };

            // Called during client deletion
            if (!clientID) {
                return cb(null);
            }

            // Deleted hook is hook that 
            // handle personal information updates
            if (updateHook) {
                // Avoid `MongoError: exception: '$set' is empty. 
                // You must specify a field like so: {$set: {<field>: ...}}`
                // by setting value to `null` not `undefined`
                update.update_notification_handler = null;
            }

            db.models.OauthClient.findByIdAndUpdate(clientID, update, options,
                                                    function (err, updatedClient) {
                if (err) {
                    return cb(err);
                }

                cb(null, updatedClient);
            });
        }]
    }, function (err, results) {
        var updatedClient = results && results.updateHooksForClient;

        if (err) {
            return cb(err);
        }

        cb(null, updatedClient);
    });
};