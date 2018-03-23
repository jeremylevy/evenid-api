var assert = require('assert');

var InvalidScopeError = require('../../../errors/types/InvalidScopeError');

describe('errors.types.InvalidScopeError', function () {
    it('throws an exception when passing invalid error message', function () {
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new InvalidScopeError(v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without message', function () {
        var errMessage = undefined;

        var err = new InvalidScopeError(errMessage);

        assert.strictEqual(err.message, 'Your access token scope doesn\'t cover requested ressource.');

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message', function () {
        var errMessage = 'bar';

        var err = new InvalidScopeError(errMessage);

        assert.strictEqual(err.message, errMessage);

        assert.ok(err instanceof Error);
    });
});