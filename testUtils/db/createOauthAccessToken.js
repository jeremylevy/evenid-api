var crypto = require('crypto');
var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var createOauthAuthorization = require('./createOauthAuthorization');

module.exports = function (cb) {
    var context = this;

    var expiresAt = new Date();
    var createAccessToken = function (expiresAt, authorizationID, cb) {
        var token = crypto
                    .createHash('sha1')
                    .update(mongoose.Types.ObjectId().toString())
                    .digest('hex');

        var hashedToken = crypto
                            .createHash(config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS)
                            .update(token)
                            .digest('hex');

        var refreshToken = crypto
                            .createHash('sha1')
                            .update(mongoose.Types.ObjectId().toString())
                            .digest('hex');
                            
        var hashedRefreshToken = crypto
                                    .createHash(config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS)
                                    .update(refreshToken)
                                    .digest('hex');
        
        // Use Object ID as token in order to avoid
        // unique constraint error
        db.models.OauthAccessToken.create({
            token: hashedToken,
            expires_at: expiresAt,
            authorization: authorizationID,
            refresh_token: hashedRefreshToken
        }, function (err, accessToken) {
            if (err) {
                return cb(err);
            }

            // Give access to unhashed values
            accessToken._token = token;
            accessToken._refresh_token = refreshToken;

            cb(null, accessToken);
        });
    };

    expiresAt.setHours(expiresAt.getHours() + 1);

    if (context.authorizationID) {
        return createAccessToken(expiresAt, context.authorizationID, cb);
    }

    createOauthAuthorization.call(context, function (err, authorization) {
        if (err) {
            return cb(err);
        }

        createAccessToken(expiresAt, authorization._id, cb);
    });
};

