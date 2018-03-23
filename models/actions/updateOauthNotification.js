var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var clone = require('clone');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

module.exports = function (clientID, userID, update, cb) {
    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(update, Object) 
              && Object.keys(update).length,
              'argument `update` must be a literal Object');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var updateConditions = {
        client: clientID,
        user: userID
    };

    var updateOptions = {
        // One document per 
        // user for client
        multi: false,
        // Create the doc 
        // if none match
        upsert: true,
        // Good for `processed_at` date
        setDefaultsOnInsert: true
    };
    
    async.auto({
        updateOauthNotification: function (cb) {
            var _update = clone(update);

            // `pending_notifications` field needs 
            // to be appended not overwritten
            Object.keys(_update).forEach(function (fieldToUpdate) {
                // `pending_notifications` are added incrementally 
                // until worker consume them.
                var updateAction = '$push';
                var fieldToIncrReg = /^pending_notifications$/;

                // Field is not `pending_notifications` field
                if (!fieldToUpdate.match(fieldToIncrReg)
                    // Empty `pending_notifications` field
                    || !_update[fieldToUpdate].length) {

                    // Make sure `pending_notifications`
                    // field will not be reseted if empty
                    if (!!fieldToUpdate.match(fieldToIncrReg)
                        && !_update[fieldToUpdate].length) {
                        
                        delete _update[fieldToUpdate];
                    }

                    return;
                }

                if (!_update[updateAction]) {
                    _update[updateAction] = {};
                }
                
                // Push each values in the update array
                _update[updateAction][fieldToUpdate] = {
                    $each: _update[fieldToUpdate]
                };

                // Make sure `pending_notifications` 
                // field will not be overwritten
                delete _update[fieldToUpdate];
            });

            db.models.OauthNotification.update(updateConditions,
                                               _update,
                                               updateOptions,  
                                               function (err, rawResponse) {
                
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }
    }, function (err, results) {
        if (err) {
            return cb(err);
        }
        
        cb(null);
    });
};