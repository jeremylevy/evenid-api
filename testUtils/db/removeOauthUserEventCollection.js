var db = require('../../models');

module.exports = function (cb) {
    db.models.OauthUserEvent.remove({}, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};