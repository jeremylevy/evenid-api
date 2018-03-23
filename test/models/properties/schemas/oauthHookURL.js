var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../../../config');

var oauthHookURL = require('../../../../models/properties/schemas/oauthHookURL');

var Schema = mongoose.Schema;

var isValidOauthHookURLObj = function (entity) {
    var oauthHookURLSchema = oauthHookURL(entity);

    assert.strictEqual(oauthHookURLSchema.type, String);
    assert.strictEqual(oauthHookURLSchema.required, entity === 'oauthHook');

    // Validate URL
    assert.strictEqual(oauthHookURLSchema.validate.length, 2);
};

describe('models.properties.schemas.oauthHookURL', function () {
    it('throws an exception when passing invalid entity', function () {
        [null, undefined, {}, [], 'foo', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                oauthHookURL(v);
            }, assert.AssertionError);
        });
    });

    it('returns valid object when passing valid entity', function () {
        isValidOauthHookURLObj('oauthClient');
        isValidOauthHookURLObj('oauthHook');
    });
});