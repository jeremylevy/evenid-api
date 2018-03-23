var assert = require('assert');
var mongoose = require('mongoose');

var ownPhoneNumber = require('../../../../models/methods/user/ownPhoneNumber');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.ownPhoneNumber', function () {
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
                ownPhoneNumber.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as phone number ID', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    ownPhoneNumber.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `false` when user doesn\'t own phone number', function (done) {
        var phoneNumberID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                phone_numbers: [phoneNumberID],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownPhoneNumber.call(user, mongoose.Types.ObjectId()),
                false
            );

            // Make sure it also works with phone number ID as string
            assert.strictEqual(
                ownPhoneNumber.call(user, mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns true when user own phone number', function (done) {
        var phoneNumberID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                phone_numbers: [phoneNumberID],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownPhoneNumber.call(user, phoneNumberID),
                true
            );

            // Make sure it also works with phone number ID as string
            assert.strictEqual(
                ownPhoneNumber.call(user, phoneNumberID.toString()),
                true
            );

            done();
        });
    });
});