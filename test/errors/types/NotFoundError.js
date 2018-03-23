var assert = require('assert');

var NotFoundError = require('../../../errors/types/NotFoundError');

describe('errors.types.NotFoundError', function () {
    it('throws an exception when passing invalid error message', function () {
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new NotFoundError(v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without message', function () {
        var errMessage = undefined;

        var err = new NotFoundError(errMessage);

        assert.strictEqual(err.message, 'The requested resource was not found.');

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message', function () {
        var errMessage = 'bar';

        var err = new NotFoundError(errMessage);

        assert.strictEqual(err.message, errMessage);

        assert.ok(err instanceof Error);
    });
});