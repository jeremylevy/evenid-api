var assert = require('assert');

var hasProfilPhoto = require('../../../../models/methods/user/hasProfilPhoto');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.hasProfilPhoto', function () {
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
                hasProfilPhoto.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when user has not profil photo', function (done) {
        createUser.call({
            user: {
                profil_photo: null
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(hasProfilPhoto.call(user), false);

            done();
        });
    });

    it('returns `true` when user has profil photo', function (done) {
        createUser.call({
            user: {
                // Valid upload hash (sha-1)
                profil_photo: 'cf23df2207d99a74fbe169e3eba035e633b65d94'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(hasProfilPhoto.call(user), true);

            done();
        });
    });
});