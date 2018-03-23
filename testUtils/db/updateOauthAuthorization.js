var db = require('../../models');

module.exports = function (query, update, cb) {
    db.models.OauthAuthorization.update(query, update, function (err, rawResponse) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};