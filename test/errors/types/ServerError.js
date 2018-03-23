var assert = require('assert');

var ServerError = require('../../../errors/types/ServerError');

describe('errors.types.ServerError', function () {
    it('throws an exception when passing invalid errors', function () {
        [undefined, null, 9, {}, '', 'bar', function () {}].forEach(function (v) {
            assert.throws(function () {
                new ServerError(v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error with errors', function () {
        var errors = ['bar'];

        var err = new ServerError(errors);

        assert.deepEqual(err.errors, errors);

        assert.ok(err instanceof Error);
    });
});