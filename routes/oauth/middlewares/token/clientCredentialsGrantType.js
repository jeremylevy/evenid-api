var validator = require('validator');
var async = require('async');

var insertOauthAccessToken = require('../../../../models/actions/insertOauthAccessToken');
var insertOauthAuthorization = require('../../../../models/actions/insertOauthAuthorization');

module.exports = function (req, res, next) {
    var resp = res.locals.resp;
    var sendRes = res.locals.sendRes;

    if (!resp) {
        throw new Error('`resp` must be set as response locals '
                        + 'property before calling `clientCredentialsGrantType` '
                        + 'middleware');
    }

    if (!sendRes) {
        throw new Error('`sendRes` must be set as response locals '
                        + 'property before calling `clientCredentialsGrantType` '
                        + 'middleware');
    }

    var grantType = validator.trim(req.body.grant_type);

    if (grantType !== 'client_credentials') {
        return next();
    }

    async.auto({
        insertOauthAuthorization: function (cb) {
            var scope = ['unauthenticated_app'];
            var userUseTestAccount = false;
            var authorizedEntities = {};

            insertOauthAuthorization(userUseTestAccount, authorizedEntities, {
                type: 'client_credentials',
                scope: scope
            }, function (err, authorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, authorization);
            });
        },

        insertOauthAccessToken: ['insertOauthAuthorization', function (cb, results) {
            var oauthAuthorization = results.insertOauthAuthorization;

            insertOauthAccessToken(oauthAuthorization, function (err, accessToken) {
                if (err) {
                    return cb(err);
                }

                // Tokens are hashed in DB, send raw values instead
                resp.access_token = accessToken._token;
                resp.refresh_token = accessToken._refresh_token;

                cb(null, accessToken);
            });
        }]
    }, function (err, results) {
        if (err) {
            return next(err);
        }

        sendRes();
    });
};