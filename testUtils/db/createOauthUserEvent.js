var db = require('../../models');

module.exports = function (oauthUserEvent, cb) {
    db.models.OauthUserEvent.create(oauthUserEvent, function (err, oauthUserEvent) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthUserEvent);
    });
};