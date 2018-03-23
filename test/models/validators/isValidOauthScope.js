var assert = require('assert');

var isValidOauthScope = require('../../../models/validators/isValidOauthScope');

describe('models.validators.isValidOauthScope', function () {
    
    it('throws an exception when passing non/empty-array '
       + 'value as valid scope values', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                isValidOauthScope(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non/empty-array '
       + 'value as scope', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                isValidOauthScope(['emails', 'first_name'])(v);
            }, assert.AssertionError);
        });
    });

    it('returns `false` when passing invalid values as scope', function () {
        [['bar'], ['name', 'bar']].forEach(function (v) {
            assert.strictEqual(isValidOauthScope(['emails', 'first_name'])(v),
                               false);
        });
    });

    it('returns `true` when passing valid values as scope', function () {
        
        [['emails'], ['first_name'], 
         ['emails', 'first_name']].forEach(function (v) {
            
            assert.strictEqual(isValidOauthScope(['emails', 'first_name'])(v),
                               true);
        });
    });
});