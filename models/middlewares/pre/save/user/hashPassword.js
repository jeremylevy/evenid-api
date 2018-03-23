var assert = require('assert');
var Type = require('type-of-is');

var bcrypt = require('bcrypt');

var config = require('../../../../../config');

var areValidObjectIDs = require('../../../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (next) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');
    
    assert.ok(Type.is(next, Function),
              'argument `next` must be a function');
    
    var user = this;

    if (!user.isModified('password')) {
        return next();
    }

    // Hash the password and store it
    bcrypt.hash(user.password, 10, function (err, hash) {
        if (err) {
            return next(err);
        } 

        user.password = hash;

        next();
    });
};