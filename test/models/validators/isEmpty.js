var assert = require('assert');

var isEmpty = require('../../../models/validators/isEmpty');

describe('models.validators.isEmpty', function () {
    it('returns `true` when passing empty values', function () {
        [null, undefined, {}, [], ''].forEach(function (v) {
            assert.strictEqual(isEmpty(v), true);
        });
    });

    it('returns `false` when passing non empty values', function () {
        ['bar', 0.0, {bar: 'bar'}, ['bar'], function () {}, true, false].forEach(function (v) {
            assert.strictEqual(isEmpty(v), false);
        });
    });
});