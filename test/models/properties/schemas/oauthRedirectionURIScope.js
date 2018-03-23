var assert = require('assert');
var Type = require('type-of-is');

var oauthRedirectionURIScope = require('../../../../models/properties/'
                                       + 'schemas/oauthRedirectionURIScope');

describe('models.properties.'
         + 'schemas.oauthRedirectionURIScope', function () {

    it('throws an exception when passing non/empty-array '
       + 'value as valid scope values', function () {
        
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                oauthRedirectionURIScope(v);
            }, assert.AssertionError);
        });
    });

    it('returns valid object when passing valid scope values', function () {
        var oauthRedirectionURIScopeSchema = oauthRedirectionURIScope(['emails', 'first_name']);

        assert.strictEqual(oauthRedirectionURIScopeSchema.type, Array);
        
        assert.deepEqual(oauthRedirectionURIScopeSchema.default, []);
        
        assert.strictEqual(oauthRedirectionURIScopeSchema.required, true);

        // `Must be set` and `Invalid scope` validators
        assert.strictEqual(oauthRedirectionURIScopeSchema.validate.length, 2);
    });
});