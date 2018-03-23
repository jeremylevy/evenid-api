var bcrypt = require('bcrypt');
var async = require('async');

var config = require('../../../../config');

var token = require('../../../../libs/token');
var createHash = require('../../../../libs/createHash');

module.exports = function (req, res, next) {
    var oauthAuthorization = res.locals.oauthAuthorization;

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `genAuthorizationCode` '
                        + 'middleware');
    }

    if (oauthAuthorization.type !== 'authorization_code') {
        return next();
    }

    async.auto({
        generateCode: function (cb) {
            token(function (err, code) {
                if (err) {
                    return cb(err);
                }

                // Authorization codes are 
                // hashed in db, send raw value to user
                res.locals.authorizationCodeToSetInURL = code;

                cb(null, code);
            });
        },

        hashCode: ['generateCode', function (cb, results) {
            var generatedCode = results.generateCode;
            var hashedCode = createHash(config.EVENID_OAUTH
                                              .HASHING_ALGORITHMS
                                              .AUTHORIZATION_CODES, generatedCode);

            cb(null, hashedCode);
        }],

        updateAuthorization: ['hashCode', function (cb, results) {                
            var code = results.hashCode;
            var expiresAt = new Date();

            expiresAt.setTime(expiresAt.getTime() 
                              + (config.EVENID_OAUTH
                                       .VALIDITY_PERIODS
                                       .AUTHORIZATION_CODES * 1000));

            oauthAuthorization.code = {
                value: code,
                is_used: false,
                expires_at: expiresAt
            };

            cb(null);
        }]
    }, function (err, results) {
        if (err) {
            return next(err);
        }

        next();
    });
};