var assert = require('assert');

var getLastName = require('../../../../../models/properties/getters/user/lastName');

var createUser = require('../../../../../testUtils/db/createUser');

describe('models.properties.getters.user.lastName', function () {
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
                getLastName.call(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-false non-string last name', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [{}, [], 18.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    getLastName.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `undefined` when last name was not set', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, false, ''].forEach(function (v) {
                assert.strictEqual(getLastName.call(user, v), undefined);
            });

            done();
        });
    });

    it('returns uppercased last name when last name was set', function (done) {
        var lastName = 'dUrAnD';

        createUser.call({
            user: {
                last_name: lastName,
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(getLastName.call(user, lastName), 'Durand');

            done();
        });
    });
});