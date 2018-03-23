var Type = require('type-of-is');

var async = require('async');
var validator = require('validator');

var config = require('../../../../config');

var db = require('../../../../models');

var createHash = require('../../../../libs/createHash');

var insertOauthAccessToken = require('../../../../models/actions/insertOauthAccessToken');
var insertOauthUserEvent = require('../../../../models/actions/insertOauthUserEvent');

var updateOauthUserStatus = require('../../../../models/actions/updateOauthUserStatus');

module.exports = function (req, res, next) {
    // Given by `checkClient` middleware 
    var client = res.locals.client;
    var clientSecretWasUsed = res.locals.clientSecretWasUsed;

    var resp = res.locals.resp;
    var sendRes = res.locals.sendRes;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `refreshTokenGrantType` '
                        + 'middleware');
    }

    if (Type.is(clientSecretWasUsed, undefined)) {
        throw new Error('`clientSecretWasUsed` must be set as response locals '
                        + 'property before calling `refreshTokenGrantType` '
                        + 'middleware');
    }

    if (!resp) {
        throw new Error('`resp` must be set as response locals '
                        + 'property before calling `refreshTokenGrantType` '
                        + 'middleware');
    }

    if (!sendRes) {
        throw new Error('`sendRes` must be set as response locals '
                        + 'property before calling `refreshTokenGrantType` '
                        + 'middleware');
    }

    var grantType = validator.trim(req.body.grant_type);
    var refreshToken = validator.trim(req.body.refresh_token);

    if (grantType !== 'refresh_token') {
        return next();
    }

    async.auto({
        findOldAccessToken: function (cb) {
            // Find access token
            var query = db.models.OauthAccessToken.findOne({
                refresh_token: createHash(config.EVENID_OAUTH
                                                .HASHING_ALGORITHMS
                                                .TOKENS, 
                                          refreshToken)
            });

            query.populate('authorization');

            query.exec(function (err, accessToken) {
                var invalidClientError = new Error();
                var invalidGrantError = new Error();

                if (err) {
                    return cb(err);
                }

                invalidClientError.name = 'invalid_client';
                invalidGrantError.name = 'invalid_grant';

                if (accessToken 
                    && accessToken.authorization 
                    && accessToken.authorization.needs_client_secret 
                    && !clientSecretWasUsed) {
                    
                    return cb(invalidClientError);
                }
                
                if (!accessToken
                    || !accessToken.authorization
                        // If authorization was not delivered to app...
                    || (accessToken.authorization.issued_to.client
                        // ... make sure refresh token was issued for this client
                        && client.id !== accessToken.authorization.issued_to.client.toString())) {

                    return cb(invalidGrantError);
                }

                resp.user_id = accessToken.authorization.issued_for;

                return cb(null, accessToken);
            });
        },

        removeOldAccessToken: ['findOldAccessToken', function (cb, results) {
            var oldAccessToken = results.findOldAccessToken;

            oldAccessToken.remove(function (err, oldAccessToken) {
                if (err) {
                    return cb(err);
                }

                cb(null, oldAccessToken);
            });
        }],

        insertNewAccessToken: ['removeOldAccessToken', function (cb, results) {
            var oldAccessToken = results.findOldAccessToken;
            var authorization = oldAccessToken.authorization;

            insertOauthAccessToken.call({
                name: 'refreshTokenGrantType',
                // Conserve values from old access token
                accessToken: {
                    logged_by_client: oldAccessToken.logged_by_client,
                    logged_with_email: oldAccessToken.logged_with_email
                }
            }, authorization, function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                // Tokens are hashed in DB, send raw value to user
                resp.access_token = accessToken._token;
                resp.refresh_token = accessToken._refresh_token;

                cb(null, accessToken);
            });
        }],

        // Access token refreshed equals login for user (ie: persistent login)
        insertOauthUserEvent: ['insertNewAccessToken', function (cb, results) {
            var oldAccessToken = results.findOldAccessToken;
            var userID = oldAccessToken.authorization.issued_for;

            if (client === 'app') {
                return cb(null);
            }

            insertOauthUserEvent(userID, client.id, 'login', function (err, oauthUserEvent) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserEvent);
            });
        }]
    }, function (err, results) {
        if (err) {
            if (['invalid_client', 'invalid_grant'].indexOf(err.name) !== -1) {
                resp.error = err.name;

                return sendRes();
            }

            return next(err);
        }
        
        sendRes();
    });
};