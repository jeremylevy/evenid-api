var crypto = require('crypto');

var config = require('../../config');

var db = require('../../models');

module.exports = function (query, update, cb) {
    // Code is hashed in DB
    ['code'].forEach(function (param) {
        if (!query[param]) {
            return;
        }

        query[param] = crypto
                        .createHash(config
                                    .EVENID_USER_RESET_PASSWORD_REQUESTS
                                    .CODE
                                    .HASHING_ALGORITHM)
                        .update(query[param])
                        .digest('hex');
    });

    db.models.UserResetPasswordRequest.update(query, 
                                              update, 
                                              function (err, rawResponse) {
        
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};