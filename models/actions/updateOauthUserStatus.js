var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var clone = require('clone');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (clientIDs, userID, update, cb) {
    assert.ok(areValidObjectIDs(clientIDs),
              'argument `clientIDs` must be an array of ObjectIDs');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(update, Object) 
              && Object.keys(update).length,
              'argument `update` must be a literal Object');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var updateConditions = {
        client: {
            $in: clientIDs
        },
        user: userID
    };

    var updateOptions = {
        // We may update status for many clients
        multi: clientIDs.length > 1
    };
    
    async.auto({
        updateOauthUserStatusStatus: function (cb) {
            var _updateConditions = clone(updateConditions);
            var _updateOptions = clone(updateOptions);

            if (!update.status) {
                return cb(null, 0);
            }

            if (update.status === 'existing_user_after_update') {
                // Forbids the transition from `new_user` 
                // (ie: clients has never called the GET user API method)
                // to `existing_user_after_update`.
                // Forbids the transition from `existing_user_after_test` (needs to update all fields) 
                // to `existing_user_after_update`.
                _updateConditions.status = {
                    $in: [
                        'existing_user', 
                        'existing_user_after_update'
                    ]
                };
            }

            if (update.status === 'existing_user_after_test') {
                // Make sure client has called the GET `/user/{user_id}` method
                // at least once (to get from `new_user` to `existing_user`).
                // `existing_user_after_update` cannot be set 
                // before `existing_user_after_test`
                _updateConditions.status = 'existing_user';
            }

            db.models.OauthUserStatus.update(_updateConditions, {
                status: update.status
            }, _updateOptions, function (err, rawResponse) {
                
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        updateOauthUserStatus: ['updateOauthUserStatusStatus', function (cb, results) {
            var _updateConditions = clone(updateConditions);
            var _updateOptions = clone(updateOptions);
            var _update = clone(update);

            // Updated by previous callback
            delete _update.status;

            if (!Object.keys(_update).length) {
                return cb(null, 0);
            }

            // `updated_*` fields needs to 
            // be appended not overwritten
            Object.keys(_update).forEach(function (fieldToUpdate) {
                // `updated_emails`, `updated_phone_numbers` 
                // and `updated_addresses` fields are added incrementally 
                // until client calls the GET user API method.
                var updateAction = '$push';
                var fieldToIncrReg = /^updated_/;

                // Field is not an `updated_*` field
                if (!fieldToUpdate.match(fieldToIncrReg)
                    // Empty `updated_*` field
                    || !_update[fieldToUpdate].length) {

                    // Make sure `updated_*` field will 
                    // not be reseted if empty
                    if (!!fieldToUpdate.match(fieldToIncrReg)
                        && !_update[fieldToUpdate].length) {
                        
                        delete _update[fieldToUpdate];
                    }

                    return;
                }

                // Prevent duplicates 
                // for user level updated fields
                if (fieldToUpdate === 'updated_fields') {
                    updateAction = '$addToSet';
                }

                if (!_update[updateAction]) {
                    _update[updateAction] = {};
                }
                
                // Push or add to set each values in the update array
                _update[updateAction][fieldToUpdate] = {
                    $each: _update[fieldToUpdate]
                };

                // Make sure `updated_*`
                // fields will not be overwritten
                delete _update[fieldToUpdate];
            });

            db.models.OauthUserStatus.update(_updateConditions, _update, _updateOptions,  
                                             function (err, rawResponse) {
                
                if (err) {
                    return cb(err);
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