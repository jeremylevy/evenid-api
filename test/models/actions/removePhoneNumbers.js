var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var removePhoneNumbers = require('../../../models/actions/removePhoneNumbers');

var compareArray = require('../../../testUtils/lib/compareArray');

var createPhoneNumber = require('../../../testUtils/db/createPhoneNumber');
var createUser = require('../../../testUtils/db/createUser');

var findPhoneNumbers = require('../../../testUtils/db/findPhoneNumbers');
var findUsers = require('../../../testUtils/db/findUsers');

describe('models.actions.removePhoneNumbers', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid phone numbers ID', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removePhoneNumbers(v, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removePhoneNumbers([mongoose.Types.ObjectId()], v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                removePhoneNumbers([mongoose.Types.ObjectId()], mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('remove phone numbers when passed valid phone numbers ID', function (done) {
        async.auto({
            /* We create three phone numbers
               and we remove only the first and the second */

            createPhoneNumber: function (cb) {
                createPhoneNumber(function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            },

            createPhoneNumber2: function (cb) {
                createPhoneNumber(function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            },

            createPhoneNumber3: function (cb) {
                createPhoneNumber(function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            },

            // Add phone numbers to client
            createUser: ['createPhoneNumber', 
                         'createPhoneNumber2', 
                         'createPhoneNumber3', 
                         function (cb, results) {
                
                var phoneNumber = results.createPhoneNumber;
                var phoneNumber2 = results.createPhoneNumber2;
                var phoneNumber3 = results.createPhoneNumber3;

                createUser.call({
                    user: {
                        password: 'azerty',
                        phone_numbers: [
                            phoneNumber._id, 
                            phoneNumber2._id, 
                            phoneNumber3._id
                        ]
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            // Only remove the first and the second phone number
            removePhoneNumbers: ['createUser', function (cb, results) {
                var phoneNumber = results.createPhoneNumber;
                var phoneNumber2 = results.createPhoneNumber2;
                var user = results.createUser

                removePhoneNumbers([
                    phoneNumber._id, 
                    phoneNumber2._id
                ], user._id, function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }],

            // Make sure first and second phone number were removed
            findPhoneNumbers: ['removePhoneNumbers', function (cb, results) {
                var phoneNumber = results.createPhoneNumber;
                var phoneNumber2 = results.createPhoneNumber2;
                var phoneNumber3 = results.createPhoneNumber3;

                findPhoneNumbers([
                    phoneNumber._id, 
                    phoneNumber2._id, 
                    phoneNumber3._id
                ], function (err, phoneNumbers) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumbers);
                });
            }],

            // Make sure user's phone numbers were updated accordingly
            findUser: ['removePhoneNumbers', function (cb, results) {
                var user = results.createUser;

                findUsers([user._id], function (err, users) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, users[0]);
                });
            }]
        }, function (err, results) {
            var phoneNumber3 = results.createPhoneNumber3;
            var phoneNumbers = results.findPhoneNumbers;
            var user = results.findUser;
            var updatedUser = results.removePhoneNumbers;

            if (err) {
                return done(err);
            }

            /* Make sure found phone numbers contain only
               the third */
            
            assert.strictEqual(phoneNumbers.length, 1);
            assert.strictEqual(phoneNumbers[0].id, phoneNumber3.id);

            /* Make sure user phone numbers contain only
               the third */
            
            assert.strictEqual(user.phone_numbers.length, 1);
            assert.strictEqual(user.phone_numbers[0].toString(), phoneNumber3.id);

            /* Check that udpated user returned by `removePhoneNumbers` function
               is the same than those found */
            
            assert.strictEqual(updatedUser.id, user.id);
            // `toObject()`: Returns a native js Array.
            assert.ok(compareArray(updatedUser.phone_numbers.toObject(), 
                                   user.phone_numbers.toObject()));

            done();
        });
    });
});