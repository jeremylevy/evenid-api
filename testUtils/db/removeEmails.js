var db = require('../../models');

module.exports = function (emailIDs, cb) {
    db.models.Email.remove({
        _id: {
            $in: emailIDs
        }
    }, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};