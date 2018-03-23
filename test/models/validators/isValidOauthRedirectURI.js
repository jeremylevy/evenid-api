var assert = require('assert');

var isValidOauthRedirectionURI = require('../../../models/validators/isValidOauthRedirectionURI');

describe('models.validators.isValidOauthRedirectionURI', function () {
    it('returns `false` when passing non-string value as URI', function () {
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.strictEqual(isValidOauthRedirectionURI(v), false);
        });
    });

    // According to RFC, the redirection endpoint URI MUST NOT include a
    // fragment component but MUST include protocol.
    it('returns `false` when passing invalid URIs', function () {
        
        ['bar', 'www.bar.com', 
         'https://www.bar.com/bar.html#bar=bar'].forEach(function (v) {
            
            assert.strictEqual(isValidOauthRedirectionURI(v), false);
        });
    });
    
    it('returns `true` when passing valid URIs', function () {
        
        ['http://bar.com', 
         'https://www.bar.com/bar.html?bar=bar&bar=bar',
         'myapp://bar'].forEach(function (v) {
            
            assert.strictEqual(isValidOauthRedirectionURI(v), true);
        });
    });
});