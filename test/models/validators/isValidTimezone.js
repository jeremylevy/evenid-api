var assert = require('assert');

var isValidTimezone = require('../../../models/validators/isValidTimezone');

describe('models.validators.isValidTimezone', function () {
    it('returns `false` when passing invalid timezone', function () {
        
        [null, undefined, {}, [], 
         '', 'bar', 0.0, {bar: 'bar'},
         ['bar'], new Error()].forEach(function (v) {
            
            assert.strictEqual(isValidTimezone(v), false);
        });
    });

    it('returns `true` when passing valid timezone', function () {
        ['Europe/Paris', 'America/Los_Angeles'].forEach(function (v) {
            assert.strictEqual(isValidTimezone(v), true);
        });
    });
});