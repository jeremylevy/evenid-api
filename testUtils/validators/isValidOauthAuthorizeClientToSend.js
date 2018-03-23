var assert = require('assert');

module.exports = function (clientToSend, clientRef) {
    // Make sure sent client contains only the five properties
    // tested below (prevent property like `client_secret` to be sent alongs response)
    assert.strictEqual(Object.keys(clientToSend).length, 5);

    // Used by recover password to customize email sent
    // to user
    assert.strictEqual(clientToSend.id, clientRef.id);
    assert.strictEqual(clientToSend.name, clientRef.name);
    assert.strictEqual(clientToSend.logo, clientRef.logo);
    assert.strictEqual(clientToSend.description, clientRef.description);
    assert.strictEqual(clientToSend.authorize_test_accounts, clientRef.authorize_test_accounts);
};