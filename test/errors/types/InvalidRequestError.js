var assert = require('assert');

var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

describe('errors.types.InvalidRequestError', function () {
    
    it('throws an exception when passing '
       + 'invalid error messages', function () {
        
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new InvalidRequestError(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid mongoose validation messages', function () {
        
        [9, [], function () {}].forEach(function (v) {
            assert.throws(function () {
                new InvalidRequestError(undefined, v);
            }, assert.AssertionError);
        });
    });

    it('constructs the error without messages '
       + 'and mongoose validation messages', function () {
        
        var err = new InvalidRequestError();

        assert.deepEqual(err.messages, {});
        assert.deepEqual(err.mongooseValidationErrors, {});

        assert.ok(err instanceof Error);
    });

    it('constructs the error with messages and '
       + 'without mongoose validation messages', function () {
        
        var messages = {bar: 'foo'};

        var err = new InvalidRequestError(messages);

        assert.deepEqual(err.messages, messages);
        assert.deepEqual(err.mongooseValidationErrors, {});

        assert.ok(err instanceof Error);
    });

    it('constructs the error without messages and '
       + 'with mongoose validation messages', function () {
        
        var mongooseValidationErrors = {bar: 'bar'}; 

        var err = new InvalidRequestError(undefined, mongooseValidationErrors);

        assert.deepEqual(err.messages, {});
        assert.deepEqual(err.mongooseValidationErrors, mongooseValidationErrors);

        assert.ok(err instanceof Error);
    });

    it('constructs the error with messages and '
       + 'mongoose validation messages', function () {
        
        var messages = {bar: 'foo'};
        var mongooseValidationErrors = {bar: 'bar'}; 

        var err = new InvalidRequestError(messages, mongooseValidationErrors);

        assert.deepEqual(err.messages, messages);
        assert.deepEqual(err.mongooseValidationErrors, mongooseValidationErrors);

        assert.ok(err instanceof Error);
    });
});