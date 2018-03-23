var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (phoneNumberIDs, userID, cb) {
    // `areValidObjectIDs` check for 
    // the `phoneNumberIDs` type and its emptiness
    assert.ok(areValidObjectIDs(phoneNumberIDs),
              'argument `phoneNumberIDs` must be an array of ObjectIDs');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        removePhoneNumbers: function (cb) {
            db.models.PhoneNumber.remove({
                _id: {
                    $in: phoneNumberIDs
                }
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // Pull phone numbers from user's phone numbers
        updatePhoneNumbersForUser: ['removePhoneNumbers', function (cb, results) {
            db.models.User.findByIdAndUpdate(userID, {
                $pull: { 
                    phone_numbers: {
                        $in: phoneNumberIDs
                    }
                }
            }, {
                // To get updated user
                new: true
            }, function (err, updatedUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, updatedUser);
            });
        }]
    }, function (err, results) {
        var updatedUser = results && results.updatePhoneNumbersForUser;

        if (err) {
            return cb(err);
        }

        cb(null, updatedUser);
    });
};