var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

module.exports = function (userAuthorization, cb) {
    assert.ok(userAuthorization
              && Type.is(userAuthorization.populate, Function),
              'argument `userAuthorization` must be a Mongoose document');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        populateUserAuthorization: function (cb) {
            var fieldsToPopulate = ['entities.emails', 
                                    'entities.phone_numbers', 
                                    'entities.addresses'].join(' ');

            userAuthorization.populate(fieldsToPopulate, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            });
        }
    }, function (err, results) {
        var userAuthorization = results && results.populateUserAuthorization;

        if (err) {
            return cb(err);
        }

        cb(null, userAuthorization);
    });
};