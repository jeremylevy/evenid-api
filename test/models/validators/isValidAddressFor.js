var assert = require('assert');

var isValidAddressFor = require('../../../models/validators/isValidAddressFor');

describe('models.validators.isValidAddressFor', function () {
    it('returns `false` when passing non/empty-array', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.strictEqual(isValidAddressFor(v), false);
        });
    });

    it('returns `false` when passing invalid values', function () {
        ['', 'foo', 'bar'].forEach(function (v) {
            assert.strictEqual(isValidAddressFor(v), false);
        });
    });

    it('returns `true` when passing valid values', function () {
        [['shipping'], ['billing'], 
         ['shipping', 'billing']].forEach(function (v) {
            
            assert.strictEqual(isValidAddressFor(v), true);
        });
    });
});