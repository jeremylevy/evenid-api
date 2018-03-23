var assert = require('assert');

var config = require('../../config');

var areValidObjectIDs = require('../../models/validators/areValidObjectIDs')
                            (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var isValidOauthAccessTokenResponse = require('./isValidOauthAccessTokenResponse');

module.exports = function (testAccountCookieMustBeDeleted, resp) {
    assert.strictEqual(Object.keys(resp).length, 
                    testAccountCookieMustBeDeleted ? 5 : 3);

    assert.strictEqual(resp.step, 'redirect');
    
    assert.strictEqual(resp.redirectTo, 'same');

    isValidOauthAccessTokenResponse(resp.accessToken);

    assert.strictEqual(resp.deleteTestAccountCookie,
                    testAccountCookieMustBeDeleted ? true : undefined);

    if (testAccountCookieMustBeDeleted) {
        assert.strictEqual(areValidObjectIDs([resp.clientID]), true); 
    } else {
        assert.strictEqual(resp.clientID, undefined); 
    }
};