var assert = require('assert');
var mongoose = require('mongoose');

var ownAddress = require('../../../../models/methods/user/ownAddress');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.ownAddress', function () {
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
                ownAddress.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as address ID', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    ownAddress.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `false` when user doesn\'t own address', function (done) {
        var addressID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                addresses: [addressID]
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownAddress.call(user, mongoose.Types.ObjectId()),
                false
            );

            // Make sure it also works with address ID as string
            assert.strictEqual(
                ownAddress.call(user, mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns `true` when user own address', function (done) {
        var addressID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                addresses: [addressID]
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownAddress.call(user, addressID),
                true
            );

            // Make sure it also works with address ID as string
            assert.strictEqual(
                ownAddress.call(user, addressID.toString()),
                true
            );

            done();
        });
    });
});