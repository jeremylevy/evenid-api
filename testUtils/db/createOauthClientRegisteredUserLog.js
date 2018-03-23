var db = require('../../models');

module.exports = function (log, cb) {
    db.models.OauthClientRegisteredUser.create(log, function (err, log) {
        if (err) {
            return cb(err);
        }

        cb(null, log);
    });
};