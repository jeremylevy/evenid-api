var assert = require('assert');
var Type = require('type-of-is');

module.exports = function (accessToken) {
    assert.ok(Type.is(accessToken, Object));

    assert.ok(Type.is(accessToken.user_id, String));
    assert.ok(accessToken.user_id.length > 0);

    assert.ok(Type.is(accessToken.access_token, String));
    assert.ok(accessToken.access_token.length > 0);

    assert.ok(Type.is(accessToken.refresh_token, String));
    assert.ok(accessToken.refresh_token.length > 0);

    assert.ok(Type.is(accessToken.expires_in, Number));
    assert.ok(accessToken.expires_in > 0);

    assert.strictEqual(accessToken.token_type, 'Bearer');
};