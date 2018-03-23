var assert = require('assert');

var isValidOauthScopeFlags = require('../../../models/validators/isValidOauthScopeFlags');

describe('models.validators.isValidOauthScopeFlags', function () {
    
    it('throws an exception when passing non/empty-array '
       + 'value as valid scope flag values', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                isValidOauthScopeFlags(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non/empty-array '
       + 'value as scope flags', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                isValidOauthScopeFlags([
                    'mobile_phone_number',
                    'separate_shipping_billing_address'
                ])(v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when passing invalid values '
       + 'as scope flags', function () {
        
        [['bar'], ['name', 'bar']].forEach(function (v) {
            assert.strictEqual(isValidOauthScopeFlags(['landline_phone_number'])(v),
                               false);
        });
    });

    it('returns `true` when passing valid values '
       + 'as scope flags', function () {
        
        [['mobile_phone_number'], 
         ['separate_shipping_billing_address'], 
         ['mobile_phone_number', 
          'separate_shipping_billing_address']].forEach(function (v) {
            
            assert.strictEqual(isValidOauthScopeFlags([
                                    'mobile_phone_number',
                                    'separate_shipping_billing_address'
                              ])(v), true);
        });
    });
});