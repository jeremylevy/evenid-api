var assert = require('assert');

var InvalidTokenError = require('../../../errors/types/InvalidTokenError');

describe('errors.types.InvalidTokenError', function () {
    it('throws an exception when passing invalid error message', function () {
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new InvalidTokenError(v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without message', function () {
        var errMessage = undefined;

        var err = new InvalidTokenError(errMessage);

        assert.strictEqual(err.message, 'Your access token is invalid.');

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message', function () {
        var errMessage = 'bar';

        var err = new InvalidTokenError(errMessage);

        assert.strictEqual(err.message, errMessage);

        assert.ok(err instanceof Error);
    });
});