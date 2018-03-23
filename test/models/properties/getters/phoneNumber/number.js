var assert = require('assert');

var getNumber = require('../../../../../models/properties/getters/phoneNumber/number');

var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

describe('models.properties.getters.phoneNumber.number', function () {
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
                getNumber.call(v, '+33618394759');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string number', function (done) {
        createPhoneNumber.call({
            number: '+33618394759',
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    getNumber.call(phoneNumber, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns phone number in national format', function (done) {
        var internationalNumber = '+33618394759';

        createPhoneNumber.call({
            number: internationalNumber,
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            // Libphonenumber returns number with spaces
            assert.strictEqual(getNumber.call(phoneNumber, internationalNumber),
                               '06 18 39 47 59');

            done();
        });
    });
});