var crypto = require('crypto');

var config = require('../../config');

var db = require('../../models');

module.exports = function (query, update, cb) {
    // Tokens are hashed in DB
    ['token', 'refresh_token'].forEach(function (token) {
        if (!query[token]) {
            return;
        }

        query[token] = crypto
                        .createHash(config.EVENID_OAUTH.HASHING_ALGORITHMS.TOKENS)
                        .update(query[token])
                        .digest('hex');
    });

    db.models.OauthAccessToken.update(query, update, function (err, rawResponse) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};