var assert = require('assert');
var Type = require('type-of-is');

var request = require('supertest');

var config = require('../../config');

var areValidObjectIDs = require('../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var findUsers = require('../db/findUsers');

var isValidOauthAccessTokenResponse = require('./isValidOauthAccessTokenResponse');

module.exports = function (responseType, redirectionURI, 
                           isTestAccount, isLoggedUser, 
                           resp, app, client, cb) {
    
    var matches = [];
    var redirectionURLPattern = '^' + redirectionURI 
                                    + '\\?code=(' + config.EVENID_OAUTH.PATTERNS.TOKENS 
                                    + ')&state=.+$';
    
    var getAccessTokenWithCode = function (redirectionURI, client, code, app, cb) {
        request(app)
            .post('/oauth/token')
            // Body parser middleware needs 
            // it to populate `req.body`
            .set('Content-Type', 'application/x-www-form-urlencoded')
            .send({
                client_id: client.client_id.toString(),
                client_secret: client.client_secret,
                grant_type: 'authorization_code',
                code: code
            })
            .end(function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp.body);
            });
    };
    
    var validateAccessTokenAndUserID = function (userID, accessToken, cb) {
        assert.ok(areValidObjectIDs([userID]));

        findUsers([userID], function (err, users) {
            if (err) {
                return cb(err);
            }

            assert.strictEqual(users.length, 0, 
                               'User ID needs to be client specific');

            request(app)
                .get('/users/' + userID)
                .set('Authorization', 'Bearer ' + accessToken)
                .end(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    
                    assert.strictEqual(resp.body.id, userID);

                    cb(null, resp.body);
                });
        });
    };

    if (responseType === 'token') {
        redirectionURLPattern = '^' + redirectionURI
                                    + '#'
                                    // Order is not guaranteed
                                    // so use lookahead assertions
                                    + '(?=.*access_token=(' 
                                        + config.EVENID_OAUTH.PATTERNS.TOKENS 
                                        + ')&?)'
                                    + '(?=.*token_type=Bearer&?)'
                                    + '(?=.*expires_in=' 
                                        + config.EVENID_OAUTH.VALIDITY_PERIODS.ACCESS_TOKENS 
                                        + '&?)'
                                    + '(?=.*state=[^&]+&?)'
                                    + '(?=.*user_id=(' 
                                        + config.EVENID_MONGODB.OBJECT_ID_PATTERN 
                                        + ')&?)'
                                    + '(?=.*user_status=(' 
                                        + config.EVENID_OAUTH.VALID_USER_STATUS.join('|')
                                        + ')&?)'; 
    }
    
    assert.strictEqual(Object.keys(resp).length, 
                       isTestAccount || !isLoggedUser ? 6 :  5);

    assert.strictEqual(resp.step, 'redirect');

    assert.ok(Type.is(resp.redirectTo, String));

    assert.strictEqual(resp.clientName, client.name);
    assert.strictEqual(resp.clientID, client.id);
    
    matches = resp.redirectTo.match(new RegExp(redirectionURLPattern));

    assert.ok(!!matches);

    if (!isTestAccount) {
        if (!isLoggedUser) {
            isValidOauthAccessTokenResponse(resp.accessToken);
        }

        assert.strictEqual(resp.deleteTestAccountCookie, true);
    } else {
        assert.strictEqual(resp.useTestAccount, true);

        assert.ok(areValidObjectIDs([resp.userID]));
    }

    if (responseType === 'code') {
        getAccessTokenWithCode(redirectionURI,
                               client, 
                               matches[1],
                               app,
                               function (err, resp) {

            if (err) {
                return cb(err);
            }
            
            validateAccessTokenAndUserID(resp.user_id, resp.access_token, cb);
        });
    } else {
        // `matches[2]`: User ID
        // `matches[1]`: Access token
        validateAccessTokenAndUserID(matches[2], matches[1], cb);
    }
};