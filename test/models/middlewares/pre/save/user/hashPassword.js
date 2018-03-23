var assert = require('assert');
var bcrypt = require('bcrypt');

var hashPassword = require('../../../../../../models/middlewares/pre/save/user/hashPassword');

var createUser = require('../../../../../../testUtils/db/createUser');

describe('models.middlewares.pre.save.user.hashPassword', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                hashPassword.call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    hashPassword.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('hash user password when modified', function (done) {
        var newPassword = 'foobar';

        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            user.password = newPassword;

            hashPassword.call(user, function () {
                bcrypt.compare(newPassword, user.password, function (err, ok) {
                    if (err) {
                        return done(err);
                    }

                    assert.strictEqual(ok, true);

                    done();
                });
            });
        });
    });
});