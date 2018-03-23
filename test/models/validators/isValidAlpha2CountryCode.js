var assert = require('assert');

var isValidAlpha2CountryCode = require('../../../models/validators/isValidAlpha2CountryCode');

describe('models.validators.isValidAlpha2CountryCode', function () {
    it('returns `false` when passing invalid country code', function () {
        
        [null, undefined, {}, [], 
         '', 'bar', 0.0, {bar: 'bar'},
         ['bar'], new Error()].forEach(function (v) {
            
            assert.strictEqual(isValidAlpha2CountryCode(v), false);
        });
    });

    it('returns `true` when passing valid country code', function () {
        ['FR', 'US', 'IT'].forEach(function (v) {
            assert.strictEqual(isValidAlpha2CountryCode(v), true);
        });
    });
});