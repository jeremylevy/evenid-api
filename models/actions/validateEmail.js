var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                                (config.EVENID_MONGODB
                                       .OBJECT_ID_PATTERN);

var NotFoundError = require('../../errors/types/NotFoundError');

module.exports = function (emailID, cb) {
    assert.ok(areValidObjectIDs([emailID]),
            'argument `emailID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    db.models.Email.findByIdAndUpdate(emailID, {
        is_verified: true
    }, {
        // return the modified document 
        // rather than the original
        new: true
    }, function (err, updatedEmail) {
        if (err) {
            return cb(err);
        }

        if (!updatedEmail) {
            return cb(new NotFoundError('Email was not found'));
        }

        cb(null, updatedEmail);
    });
};