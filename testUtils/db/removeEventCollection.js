var db = require('../../models');

module.exports = function (cb) {
    db.models.Event.remove({}, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};