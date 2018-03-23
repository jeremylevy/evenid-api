var assert = require('assert');

var isValidPhoneNumberForRegion = require('../../../models/validators/isValidPhoneNumberForRegion');

describe('models.validators.isValidPhoneNumberForRegion', function () {
    it('returns `false` when passing '
       + 'non-string value as phone number', function () {
        
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.strictEqual(isValidPhoneNumberForRegion(v, 'US'),
                                false);
        });
    });

    it('returns `false` when passing '
       + 'non-string value as region', function () {
        
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.strictEqual(isValidPhoneNumberForRegion('0638734803', v),
                                false);
        });
    });

    it('returns `false` when passing '
       + 'invalid phone numbers for country', function () {
        
        [{
            number: '732-757-2923', 
            country: 'FR'
        }, {
            number: '0638734803', 
            country: 'US'
        }].forEach(function (v) {
            assert.strictEqual(isValidPhoneNumberForRegion(v.number, v.country),
                                false);
        });
    });

    it('returns `true` when passing '
       + 'valid phone numbers for country', function () {
        
        [{
            number: '0638734803', 
            country: 'FR'
        }, {
            number: '732-757-2923', 
            country: 'US'
        }].forEach(function (v) {
            assert.strictEqual(isValidPhoneNumberForRegion(v.number, v.country),
                                true);
        });
    });
});