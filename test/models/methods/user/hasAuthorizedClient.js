var assert = require('assert');
var mongoose = require('mongoose');

var hasAuthorizedClient = require('../../../../models/methods/user/hasAuthorizedClient');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.hasAuthorizedClient', function () {
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
                hasAuthorizedClient.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    hasAuthorizedClient.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `false` when user has not authorized client', function (done) {
        var clientID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                authorized_clients: [clientID]
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                hasAuthorizedClient.call(user, mongoose.Types.ObjectId()), 
                false
            );

            // Make sure it also works with client ID as string
            assert.strictEqual(
                hasAuthorizedClient.call(user, mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns `true` when user has authorized client', function (done) {
        var clientID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                authorized_clients: [clientID]
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                hasAuthorizedClient.call(user, clientID), 
                true
            );

            // Make sure it also works with client ID as string
            assert.strictEqual(
                hasAuthorizedClient.call(user, clientID.toString()),
                true
            );

            done();
        });
    });
});