var assert = require('assert');

var ExpiredTokenError = require('../../../errors/types/ExpiredTokenError');

describe('errors.types.ExpiredTokenError', function () {
    it('throws an exception when passing invalid error message', function () {
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new ExpiredTokenError(v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without message', function () {
        var errMessage = undefined;

        var err = new ExpiredTokenError(errMessage);

        assert.strictEqual(err.message, 'Your access token has expired.');

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message', function () {
        var errMessage = 'bar';

        var err = new ExpiredTokenError(errMessage);

        assert.strictEqual(err.message, errMessage);

        assert.ok(err instanceof Error);
    });
});