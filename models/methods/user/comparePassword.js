var assert = require('assert');
var Type = require('type-of-is');

var bcrypt = require('bcrypt');
var changeCase = require('change-case');

var async = require('async');

var config = require('../../../config');

var areValidObjectIDs = require('../../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (password, cb) {
    assert.ok(areValidObjectIDs([this._id]),
              'context must be set as an `User` document');

    assert.ok(Type.is(password, String),
              'argument `password` must be a string');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var user = this;

    /* EvenID actually accepts three forms of password */

    // Your original password.
    var originalPassword = password;
    // Your original password with the case reversed, 
    // for those with a caps lock key on.
    var passwordWithCaseInverted = changeCase.swapCase(originalPassword);
    // Your original password with the first letter capitalized. 
    // This is only for mobile devices, which sometimes capitalize 
    // the first character of a word.
    var passwordWithFirstLetterLowerCased = changeCase.lowerCaseFirst(originalPassword);

    /* END */

    var comparePassword = function (password) {
        return function (cb) {
            bcrypt.compare(password, user.password, function (err, ok) {
                // We don't want main callback 
                // to be called for each errors
                if (err) {
                    comparePasswordErrors.push(err);

                    return cb(null, false);
                }

                cb(null, ok);
            });
        };
    };
    var comparePasswordErrors = [];

    async.parallel([
        comparePassword(originalPassword),
        comparePassword(passwordWithCaseInverted),
        comparePassword(passwordWithFirstLetterLowerCased)
    ], function (err, results) {
        var passwordMatch = false;

        if (comparePasswordErrors.length) {
            return cb(comparePasswordErrors[0], false);
        }

        results.forEach(function (passwordHasMatched) {
            if (!passwordHasMatched) {
                return;
            }

            passwordMatch = true;
        });

        cb(null, passwordMatch);
    });
};