var assert = require('assert');
var Type = require('type-of-is');
var mongoose = require('mongoose');

var setPhoneType = require('../../../../../models/properties/setters/phoneNumber/phoneType');

var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

describe('models.properties.setters.phoneNumber.phoneType', function () {
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
                setPhoneType.call(v);
            }, assert.AssertionError);
        });
    });

    it('does not set `_old_phone_type` property '
       + 'when phone type was not updated', function (done) {

        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            // Assert it returns value to set
            assert.strictEqual(
                setPhoneType.call(phoneNumber, phoneNumber.phone_type),
                phoneNumber.phone_type
            );

            assert.strictEqual(phoneNumber._old_phone_type, undefined);

            done();
        });
    });

    it('does not set `_old_phone_type` property '
       + 'if it was already set', function (done) {

        createPhoneNumber.call({
            number: '0619485948',
            phone_type: 'mobile',
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber._old_phone_type = 'bar';

            // Assert it returns value to set
            assert.strictEqual(
                setPhoneType.call(phoneNumber, 'landline'),
                'landline'
            );

            assert.strictEqual(phoneNumber._old_phone_type, 'bar');

            done();
        });
    });

    it('set `_old_phone_type` property when phone type '
       + 'was set for the first time ', function (done) {

        createPhoneNumber.call({
            number: '0619485948',
            phone_type: 'mobile',
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            // Assert it returns value to set
            assert.strictEqual(
                setPhoneType.call(phoneNumber, 'landline'),
                'landline'
            );

            assert.strictEqual(phoneNumber._old_phone_type, 'mobile');

            done();
        });
    });
});