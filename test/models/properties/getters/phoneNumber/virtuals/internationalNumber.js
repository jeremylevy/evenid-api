var assert = require('assert');

var getInternationalNumber = require('../../../../../../models/properties/'
                                     + 'getters/phoneNumber/virtuals/internationalNumber');

var createPhoneNumber = require('../../../../../../testUtils/db/createPhoneNumber');

describe('models.properties.getters.'
         + 'phoneNumber.virtuals.internationalNumber', function () {

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
                getInternationalNumber.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns `null` when invalid number', function (done) {
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = 'bar';

            assert.strictEqual(getInternationalNumber.call(phoneNumber), null);

            done();
        });
    });

    it('returns phone number in international format', function (done) {
        createPhoneNumber.call({
            number: '0618394759',
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(getInternationalNumber.call(phoneNumber), '+33618394759');

            done();
        });
    });
});