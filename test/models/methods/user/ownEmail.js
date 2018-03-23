var assert = require('assert');
var mongoose = require('mongoose');

var ownEmail = require('../../../../models/methods/user/ownEmail');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.ownEmail', function () {
    // Connect to database
    before(function (done) {
        require('../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                ownEmail.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as email ID', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    ownEmail.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `false` when user doesn\'t own email', function (done) {
        var emailID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                emails: [emailID],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEmail.call(user, mongoose.Types.ObjectId()),
                false
            );

            // Make sure it also works with email ID as string
            assert.strictEqual(
                ownEmail.call(user, mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns `true` when user own email', function (done) {
        var emailID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                emails: [emailID],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEmail.call(user, emailID),
                true
            );

            // Make sure it also works with email ID as string
            assert.strictEqual(
                ownEmail.call(user, emailID.toString()),
                true
            );

            done();
        });
    });
});