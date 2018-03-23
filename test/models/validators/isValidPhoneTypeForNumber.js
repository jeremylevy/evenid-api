var assert = require('assert');

var createPhoneNumber = require('../../../testUtils/db/createPhoneNumber');

var isValidPhoneTypeForNumber = require('../../../models/validators/isValidPhoneTypeForNumber');

describe('models.validators.isValidPhoneTypeForNumber', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-phone-number as context', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                isValidPhoneTypeForNumber.call(v, '+33610893749');
            }, assert.AssertionError);
        });
    });

    it('returns `false` when passing '
       + 'invalid phone number', function (done) {
        
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, 'bar'),
                               false);

            done();
        });
    });

    it('returns `true` when passing phone number '
       + 'with undefined phone type', function (done) {
        
        createPhoneNumber.call({
            phoneType: undefined
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, '+33610893749'),
                               true);

            done();
        });
    });

    it('returns `true` when passing phone number '
       + 'with unknown phone type', function (done) {
        
        createPhoneNumber.call({
            phoneType: 'unknown'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, '+33610893749'),
                               true);

            done();
        });
    });

    it('returns `false` when passing landline number '
       + 'for mobile phone type', function (done) {
        
        createPhoneNumber.call({
            phoneType: 'mobile'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, '+33410893749'),
                      false);

            done();
        });
    });

    it('returns `false` when passing mobile number '
       + 'for landline phone type', function (done) {
        
        createPhoneNumber.call({
            number: '+33410893749',
            phoneType: 'landline'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, '+33610893749'),
                               false);

            done();
        });
    });

    it('returns `true` when passing mobile number '
       + 'for mobile phone type', function (done) {
        
        createPhoneNumber.call({
            phoneType: 'mobile'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, '+33610893749'),
                               true);

            done();
        });
    });

    it('returns `true` when passing landline number '
       + 'for landline phone type', function (done) {
        
        createPhoneNumber.call({
            number: '+33410893749',
            phoneType: 'landline'
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(isValidPhoneTypeForNumber.call(phoneNumber, '+33412893749'),
                               true);

            done();
        });
    });
});