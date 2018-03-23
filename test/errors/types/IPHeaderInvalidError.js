var assert = require('assert');

var InvalidRequestError = require('../../../errors/types/InvalidRequestError');
var IPHeaderInvalidError = require('../../../errors/types/IPHeaderInvalidError');

describe('errors.types.IPHeaderInvalidError', function () {
    it('constructs the error', function () {
        var err = new IPHeaderInvalidError();

        assert.strictEqual(err.messages['X-Originating-IP'], 'The "x-originating-ip" header is invalid.');

        assert.ok(err instanceof InvalidRequestError);
        assert.ok(err instanceof Error);
    });
});