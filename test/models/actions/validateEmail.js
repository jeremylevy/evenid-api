var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var validateEmail = require('../../../models/actions/validateEmail');

var createEmail = require('../../../testUtils/db/createEmail');
var findEmails = require('../../../testUtils/db/findEmails');

var NotFoundError = require('../../../errors/types/NotFoundError');

describe('models.actions.validateEmail', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-ObjectID as emailID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                validateEmail(v, 
                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                validateEmail(mongoose.Types.ObjectId().toString(), 
                              v);
            }, assert.AssertionError);
        });
    });

    it('returns `NotFoundError` when user email doesn\'t exist', function (done) {
        var emailID = mongoose.Types.ObjectId().toString();

        validateEmail(emailID, function (err, updatedEmail) {
            assert.ok(err && !updatedEmail);

            assert.ok(err instanceof NotFoundError);

            assert.strictEqual(err.message, 'Email was not found');

            done();
        });
    });

    it('updates email when user email exists', function (done) {
        async.auto({
            createEmail: function (cb) {
                createEmail.call({
                    isVerified: false
                }, cb);
            },

            assertCreatedEmailIsNotVerified: ['createEmail', function (cb, results) {
                var email = results.createEmail;

                findEmails([email.id], function (err, emails) {
                    var email = emails && emails[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    assert.strictEqual(email.is_verified, false);

                    cb();
                });
            }],

            validateEmail: ['assertCreatedEmailIsNotVerified', function (cb, results) {
                var email = results.createEmail;

                validateEmail(email.id, function (err, updatedEmail) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(updatedEmail.is_verified, true);

                    cb(null, updatedEmail);
                });
            }],

            assertEmailIsVerified: ['validateEmail', function (cb, results) {
                var email = results.createEmail;

                findEmails([email.id], function (err, emails) {
                    var email = emails && emails[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(emails.length, 1);

                    assert.strictEqual(email.is_verified, true);

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});