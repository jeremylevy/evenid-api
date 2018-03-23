var assert = require('assert');
var Type = require('type-of-is');

var setPhoneType = require('../../../../../../models/middlewares/pre/validate/phoneNumber/setPhoneType');

var createPhoneNumber = require('../../../../../../testUtils/db/createPhoneNumber');

describe('models.middlewares.pre.validate.user.setPhoneType', function () {
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
                setPhoneType.call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function (done) {
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    setPhoneType.call(phoneNumber, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('doesn\'t throw an exception when passing invalid number', function (done) {
        createPhoneNumber.call({
            number: '732-757-2923', 
            country: 'US'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = 'foobar';

            assert.doesNotThrow(function () {
                setPhoneType.call(phoneNumber, done);
            }, assert.AssertionError);
        });
    });

    it('sets phone type to `unknown` when phone type '
       + 'cannot be determined automatically', function (done) {
        
        createPhoneNumber.call({
            number: '732-757-2923', 
            country: 'US'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.phone_type = undefined;

            setPhoneType.call(phoneNumber, function () {
                assert.strictEqual(phoneNumber.phone_type, 'unknown');

                done();
            });
        });
    });

    it('sets phone type to `landline` when landline number', function (done) {
        createPhoneNumber.call({
            number: '+33410485947', 
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.phone_type = undefined;

            setPhoneType.call(phoneNumber, function () {
                assert.strictEqual(phoneNumber.phone_type, 'landline');

                done();
            });
        });
    });

    it('sets phone type to `mobile` when mobile number', function (done) {
        createPhoneNumber.call({
            number: '+33638498447', 
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.phone_type = undefined;

            setPhoneType.call(phoneNumber, function () {
                assert.strictEqual(phoneNumber.phone_type, 'mobile');

                done();
            });
        });
    });

    it('sets phone type to landline when only number was updated', function (done) {
        createPhoneNumber.call({
            number: '+33638498447', 
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = '+33438394857';

            setPhoneType.call(phoneNumber, function () {
                assert.strictEqual(phoneNumber.phone_type, 'landline');

                done();
            });
        });
    });

    it('sets phone type to mobile when only number was updated', function (done) {
        createPhoneNumber.call({
            number: '+33410485947',
            country: 'FR'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.number = '+33638498447';

            setPhoneType.call(phoneNumber, function () {
                assert.strictEqual(phoneNumber.phone_type, 'mobile');

                done();
            });
        });
    });
});