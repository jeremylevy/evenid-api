var assert = require('assert');

var MaxAttemptsError = require('../../../errors/types/MaxAttemptsError');

var defaultErrorMessage = 'Too many attempts were made. Please try again later.';

describe('errors.types.MaxAttemptsError', function () {
    
    it('throws an exception when passing '
       + 'invalid error message', function () {
        
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new MaxAttemptsError(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid captcha error', function () {
        
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new MaxAttemptsError(undefined, v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without message '
       + 'and captcha error', function () {
        
        var err = new MaxAttemptsError();

        assert.strictEqual(err.message, defaultErrorMessage);
        assert.strictEqual(err.captchaError, false);

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message '
       + 'and without captcha error', function () {
        
        var errMessage = 'bar';
        var err = new MaxAttemptsError(errMessage);

        assert.strictEqual(err.message, errMessage);
        assert.strictEqual(err.captchaError, false);

        assert.ok(err instanceof Error);
    });

    it('constructs the error without message '
       + 'and with captcha error', function () {
        
        var err = new MaxAttemptsError(undefined, true);

        assert.strictEqual(err.message, defaultErrorMessage);
        assert.strictEqual(err.captchaError, true);

        assert.ok(err instanceof Error);
    });

    it('constructs the error with message '
       + 'and with captcha error', function () {
        
        var errMessage = 'bar';
        var err = new MaxAttemptsError(errMessage, true);

        assert.strictEqual(err.message, errMessage);
        assert.strictEqual(err.captchaError, true);

        assert.ok(err instanceof Error);
    });
});