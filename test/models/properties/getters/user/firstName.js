var assert = require('assert');

var getFirstName = require('../../../../../models/properties/getters/user/firstName');

var createUser = require('../../../../../testUtils/db/createUser');

describe('models.properties.getters.user.firstName', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                getFirstName.call(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-false non-string first name', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [{}, [], 18.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    getFirstName.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `undefined` when first name was not set', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, false, ''].forEach(function (v) {
                assert.strictEqual(getFirstName.call(user, v), undefined);
            });

            done();
        });
    });

    it('returns uppercased first name when first name was set', function (done) {
        var firstName = 'jOhN';

        createUser.call({
            user: {
                first_name: firstName,
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(getFirstName.call(user, firstName), 'John');

            done();
        });
    });
});