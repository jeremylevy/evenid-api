var assert = require('assert');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

describe('errors.types.AccessDeniedError', function () {
    it('throws an exception when passing invalid error message', function () {
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new AccessDeniedError(v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without message', function () {
        var errMessage = undefined;

        var err = new AccessDeniedError(errMessage);

        assert.strictEqual(err.message, 'You are not authorized to access this resource.');

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message', function () {
        var errMessage = 'bar';

        var err = new AccessDeniedError(errMessage);

        assert.strictEqual(err.message, errMessage);

        assert.ok(err instanceof Error);
    });
});