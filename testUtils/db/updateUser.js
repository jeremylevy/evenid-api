var db = require('../../models');

module.exports = function (query, update, cb) {
    db.models.User.update(query, update, function (err, rawResponse) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};