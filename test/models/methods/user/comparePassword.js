var assert = require('assert');

var comparePassword = require('../../../../models/methods/user/comparePassword');

var createUser = require('../../../../testUtils/db/createUser');

describe('models.methods.user.comparePassword', function () {
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
                comparePassword.call(v, 'foo', function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string password', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    comparePassword.call(user, v, function () {});
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('throws an exception when passing non-function as callback', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    comparePassword.call(user, 'foo', v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `false` when passing invalid password', function (done) {
        createUser.call({
            user: {
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            comparePassword.call(user, 'bar', function (err, ok) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(ok, false);

                done();
            });
        });
    });

    it('returns `true` when passing valid password', function (done) {
        createUser.call({
            user: {
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            comparePassword.call(user, 'foobar', function (err, ok) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(ok, true);

                done();
            });
        });
    });

    it('returns `true` when passing valid password '
       + 'with inverted case', function (done) {
        
        createUser.call({
            user: {
                password: 'FooBar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            comparePassword.call(user, 'fOObAR', function (err, ok) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(ok, true);

                done();
            });
        });
    });

    it('returns `true` when passing valid password '
       + 'with first letter upper-cased', function (done) {
        
        createUser.call({
            user: {
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            comparePassword.call(user, 'Foobar', function (err, ok) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(ok, true);

                done();
            });
        });
    });
});