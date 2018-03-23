var Type = require('type-of-is');

var validator = require('validator');
var async = require('async');

var config = require('../../../../config');

var db = require('../../../../models');

var createHash = require('../../../../libs/createHash');

var removeOauthAuthorizations = require('../../../../models/actions/removeOauthAuthorizations');

var insertOauthAccessToken = require('../../../../models/actions/insertOauthAccessToken');

module.exports = function (req, res, next) {
    // Given by checkClient middleware
    var client = res.locals.client;
    var clientSecretWasUsed = res.locals.clientSecretWasUsed;

    var resp = res.locals.resp;
    var sendRes = res.locals.sendRes;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `authorizationCodeGrantType` '
                        + 'middleware');
    }

    if (Type.is(clientSecretWasUsed, undefined)) {
        throw new Error('`clientSecretWasUsed` must be set as response locals '
                        + 'property before calling `authorizationCodeGrantType` '
                        + 'middleware');
    }

    if (!resp) {
        throw new Error('`resp` must be set as response locals '
                        + 'property before calling `authorizationCodeGrantType` '
                        + 'middleware');
    }

    if (!sendRes) {
        throw new Error('`sendRes` must be set as response locals '
                        + 'property before calling `authorizationCodeGrantType` '
                        + 'middleware');
    }
    
    var grantType = validator.trim(req.body.grant_type);
    var code = validator.trim(req.body.code);

    if (grantType !== 'authorization_code') {
        return next();
    }

    async.auto({
        findOauthAuthorization: function (cb) { 
            // Find Oauth authorization issued 
            // for this client with passed code
            var query = db.models.OauthAuthorization.findOne({
                'issued_to.client': client._id,
                'code.value': createHash(config.EVENID_OAUTH
                                               .HASHING_ALGORITHMS
                                               .AUTHORIZATION_CODES, code)
            });

            query.exec(function (err, oauthAuthorization) {
                var invalidClientError = new Error();
                var invalidGrantError = new Error();
                
                if (err) {
                    return cb(err);
                }

                invalidClientError.name = 'invalid_client';
                invalidGrantError.name = 'invalid_grant'

                if (oauthAuthorization
                    && oauthAuthorization.needs_client_secret
                    && !clientSecretWasUsed) {

                    return cb(invalidClientError);
                }

                // Invalid code
                if (!oauthAuthorization
                    // Expired
                    || oauthAuthorization.code.expires_at <= new Date()
                    // Used
                    || oauthAuthorization.code.is_used) {

                    // Used code? Expired code?
                    // According to spec, remove issued authorization
                    if (oauthAuthorization) {
                        // `null`, `null` -> `clientID` and `userIDs` are set 
                        // when user revock access to client
                        // or when client was removed
                        return removeOauthAuthorizations([oauthAuthorization._id], 
                                                         null, null, function (err) {
                            cb(invalidGrantError);
                        });
                    }

                    return cb(invalidGrantError);
                }

                resp.user_id = oauthAuthorization.issued_for;

                cb(null, oauthAuthorization);
            });
        },

        setIsUsedForOauthAuthorizationCode: ['findOauthAuthorization', function (cb, results) {
            var oauthAuthorization = results.findOauthAuthorization;

            oauthAuthorization.code.is_used = true;

            oauthAuthorization.save(function (err, oauthAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthAuthorization);
            });
        }],

        insertOauthAccessToken: ['setIsUsedForOauthAuthorizationCode', function (cb, results) {
            var oauthAuthorization = results.findOauthAuthorization;

            insertOauthAccessToken(oauthAuthorization, function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                // Tokens are hashed in DB, send raw value to user
                resp.access_token = accessToken._token;
                resp.refresh_token = accessToken._refresh_token;

                cb(null, accessToken);
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