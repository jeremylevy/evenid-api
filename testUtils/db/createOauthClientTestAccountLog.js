var db = require('../../models');

module.exports = function (log, cb) {
    db.models.OauthClientTestAccount.create(log, function (err, log) {
        if (err) {
            return cb(err);
        }

        cb(null, log);
    });
};