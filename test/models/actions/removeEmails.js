var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var removeEmails = require('../../../models/actions/removeEmails');

var compareArray = require('../../../testUtils/lib/compareArray');

var createEmail = require('../../../testUtils/db/createEmail');
var createUser = require('../../../testUtils/db/createUser');

var findEmails = require('../../../testUtils/db/findEmails');
var findUsers = require('../../../testUtils/db/findUsers');

describe('models.actions.removeEmails', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid emails', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeEmails(v, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeEmails([mongoose.Types.ObjectId()], v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                removeEmails([mongoose.Types.ObjectId()], mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('remove emails when passed valid email IDs', function (done) {
        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createEmail2: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createEmail3: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createUser: ['createEmail', 'createEmail2', 'createEmail3', function (cb, results) {
                var email = results.createEmail;
                var email2 = results.createEmail2;
                var email3 = results.createEmail3;

                createUser.call({
                    user: {
                        emails: [email._id, email2._id, email3._id],
                        password: 'azerty'
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            // Only remove the first and the second email
            removeEmails: ['createUser', function (cb, results) {
                var email = results.createEmail;
                var email2 = results.createEmail2;
                var user = results.createUser

                removeEmails([email._id, email2._id], user._id, function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }],

            findEmails: ['removeEmails', function (cb, results) {
                var email = results.createEmail;
                var email2 = results.createEmail2;
                var email3 = results.createEmail3;

                findEmails([email._id, email2._id, email3._id], function (err, emails) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, emails);
                });
            }],

            findUser: ['removeEmails', function (cb, results) {
                var user = results.createUser;

                findUsers([user._id], function (err, users) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, users[0]);
                });
            }]
        }, function (err, results) {
            var email3 = results.createEmail3;
            var emails = results.findEmails;
            var user = results.findUser;
            var updatedUser = results.removeEmails;

            if (err) {
                return done(err);
            }

            /* Make sure found emails contain only
               the third */
            
            assert.strictEqual(emails.length, 1);
            assert.strictEqual(emails[0].id, email3.id);

            /* Make sure user emails contain only
               the third */
            
            assert.strictEqual(user.emails.length, 1);
            assert.strictEqual(user.emails[0].toString(), email3.id);

            /* Check that udpated user returned by `removeEmails` function
               is the same than those found */
            
            assert.strictEqual(updatedUser.id, user.id);

            // `toObject()`: Returns a native js Array.
            assert.ok(compareArray(updatedUser.emails.toObject(), user.emails.toObject()));

            done();
        });
    });
});