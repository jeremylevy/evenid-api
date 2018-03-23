var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var token = require('../../libs/token');
var createHash = require('../../libs/createHash');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (oauthAuthorization, cb) {
    assert.ok(oauthAuthorization && areValidObjectIDs([oauthAuthorization._id]),
              'argument `oauthAuthorization` must be '
              + 'an `oauthAuthorization` entity');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var context = this;

    var usedDuringRefreshTokenGrantType = context && context.name === 'refreshTokenGrantType';
    var usedDuringPasswordGrantOnClient = context && context.name === 'passwordGrantOnClient';

    // Keep values from old access token during token refresh
    if (usedDuringRefreshTokenGrantType) {
        if (!context.accessToken) {
            throw new Error('context must contains `accessToken` property');
        }

        /* `logged_*` properties may be `undefined` so check for keys only */
        
        if (!('logged_by_client' in context.accessToken)) {
            throw new Error('context `accessToken` must contains `logged_by_client` property');
        }

        if (!('logged_with_email' in context.accessToken)) {
            throw new Error('context `accessToken` must contains `logged_with_email` property');
        }
    }

    // Set when user log into EvenID through client dialog
    if (usedDuringPasswordGrantOnClient) {
        if (!context.logged_by_client) {
            throw new Error('context must contains `logged_by_client` property');
        }

        if (!context.logged_with_email) {
            throw new Error('context must contains `logged_with_email` property');
        }
    }

    async.auto({
        generateAccessToken: function (cb) {
            token(function (err, token) {
                if (err) {
                    return cb(err);
                }

                cb(null, token);
            });
        },

        generateRefreshToken: function (cb) {
            token(function (err, token) {
                if (err) {
                    return cb(err);
                }

                cb(null, token);
            });
        },

        insertOauthAccessToken: ['generateAccessToken', 
                                 'generateRefreshToken', 
                                 function (cb, results) {
                                
            var accessToken = results.generateAccessToken;
            var refreshToken = results.generateRefreshToken;
            var oauthAccessToken = {};
            var expiresAt = new Date();

            expiresAt.setTime(expiresAt.getTime() 
                              + (config.EVENID_OAUTH
                                       .VALIDITY_PERIODS
                                       .ACCESS_TOKENS * 1000));

            oauthAccessToken = {
                token: createHash(config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                  accessToken),

                refresh_token: createHash(config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS,
                                          refreshToken),
                
                authorization: oauthAuthorization._id,
                expires_at: expiresAt
            };

            // Keep values from old access token during
            // token refresh
            if (usedDuringRefreshTokenGrantType) {
                oauthAccessToken.logged_by_client = context.accessToken.logged_by_client;
                oauthAccessToken.logged_with_email = context.accessToken.logged_with_email;
            }

            // Set when user log into EvenID through client dialog
            if (usedDuringPasswordGrantOnClient) {
                oauthAccessToken.logged_by_client = context.logged_by_client;
                oauthAccessToken.logged_with_email = context.logged_with_email;
            }

            db.models.OauthAccessToken.create(oauthAccessToken, function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                accessToken = accessToken.toObject();

                // Tokens are hashed before save
                // Returns raw values alongs hashed
                // to enable sending it to app/client
                accessToken._token = results.generateAccessToken;
                accessToken._refresh_token = results.generateRefreshToken;

                cb(null, accessToken);
            });
        }]
    }, function (err, results) {
        var accessToken = results && results.insertOauthAccessToken;

        if (err) {
            return cb(err);
        }

        cb(null, accessToken);
    });
};