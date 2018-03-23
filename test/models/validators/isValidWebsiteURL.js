var assert = require('assert');

var isValidWebsiteURL = require('../../../models/validators/isValidWebsiteURL');

describe('models.validators.isValidWebsiteURL', function () {
    it('returns `false` when passing non-string value as URL', function () {
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.strictEqual(isValidWebsiteURL(v), false);
        });
    });

    it('returns `false` when passing invalid URLs', function () {
        ['bar', 'http://', 'https://', 'http://bar'].forEach(function (v) {
            assert.strictEqual(isValidWebsiteURL(v), false);
        });
    });

    it('returns `true` when passing valid URLs', function () {
        [
            'http://bar.com', 
            'https://www.bar.com/bar.html?bar=bar&bar=bar#bar=bar'
        ].forEach(function (v) {
            assert.strictEqual(isValidWebsiteURL(v), true);
        });
    });
});