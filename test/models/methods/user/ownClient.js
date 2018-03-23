var assert = require('assert');
var mongoose = require('mongoose');

var ownClient = require('../../../../models/methods/user/ownClient');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.ownClient', function () {
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
                ownClient.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as client ID', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    ownClient.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `false` when user doesn\'t own client', function (done) {
        var clientID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                developer:{
                    clients: [clientID]
                },
                is_developer: true
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownClient.call(user, mongoose.Types.ObjectId()),
                false
            );

            // Make sure it also works with client ID as string
            assert.strictEqual(
                ownClient.call(user, mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns `true` when user own client', function (done) {
        var clientID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                developer:{
                    clients: [clientID]
                },
                is_developer: true
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownClient.call(user, clientID),
                true
            );

            // Make sure it also works with client ID as string
            assert.strictEqual(
                ownClient.call(user, clientID.toString()),
                true
            );

            done();
        });
    });
});