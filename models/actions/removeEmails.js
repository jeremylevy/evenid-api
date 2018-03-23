var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (emailIDs, userID, cb) {
    // `areValidObjectIDs` check for 
    // the `emailIDs` type and its emptiness
    assert.ok(areValidObjectIDs(emailIDs),
              'argument `emailIDs` must be an array of ObjectIDs');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        removeEmails: function (cb) {
            db.models.Email.remove({
                _id: {
                    $in: emailIDs
                }
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // Pull emails from user's emails
        updateEmailsForUser: ['removeEmails', function (cb, results) {
            db.models.User.findByIdAndUpdate(userID, {
                $pull: { 
                    emails: {
                        $in: emailIDs
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
        var updatedUser = results && results.updateEmailsForUser;

        if (err) {
            return cb(err);
        }

        cb(null, updatedUser);
    });
};