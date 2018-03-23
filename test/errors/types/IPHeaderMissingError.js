var assert = require('assert');

var InvalidRequestError = require('../../../errors/types/InvalidRequestError');
var IPHeaderMissingError = require('../../../errors/types/IPHeaderMissingError');

describe('errors.types.IPHeaderMissingError', function () {
    it('constructs the error', function () {
        var err = new IPHeaderMissingError();

        assert.strictEqual(err.messages['X-Originating-IP'], 'The "x-originating-ip" header must be set.');

        assert.ok(err instanceof InvalidRequestError);
        assert.ok(err instanceof Error);
    });
});