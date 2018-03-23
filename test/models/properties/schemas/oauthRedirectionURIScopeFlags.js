var assert = require('assert');
var Type = require('type-of-is');

var oauthRedirectionURIScopeFlags = require('../../../../models/properties/'
                                            + 'schemas/oauthRedirectionURIScopeFlags');

describe('models.properties.schemas.'
         + 'oauthRedirectionURIScopeFlags', function () {
   
    it('returns valid object', function () {
        var oauthRedirectionURIScopeFlagsSchema = oauthRedirectionURIScopeFlags();

        assert.strictEqual(oauthRedirectionURIScopeFlagsSchema.type, Array);
        
        assert.deepEqual(oauthRedirectionURIScopeFlagsSchema.default, []);

        // `Invalid scope` validator (scope flags may be empty)
        assert.strictEqual(oauthRedirectionURIScopeFlagsSchema.validate.length, 1);
    });
});