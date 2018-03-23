var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (userID, cb) {
    var user = null;

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    user = db.models.User.findById(userID);

    // Populate email addresses
    // in order to access gravatar.
    // Don't just populate main address
    // during email deletion, we needs all
    // emails to check that user own one of it.
    user.populate({
        path: 'emails'
    });

    user.exec(function (err, user) {
        if (err) {
            return cb(err);
        }

        cb(null, user);
    });
};