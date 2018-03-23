var db = require('../../models');

module.exports = function (conditions, cb) {
    db.models.OauthAuthorization.remove(conditions, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};