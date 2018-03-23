var db = require('../../models');

module.exports = function (query, update, cb) {
    db.models.OauthClient.update(query, update, function (err, rawResponse) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};