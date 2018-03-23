var db = require('../../models');

module.exports = function (users, cb) {
    db.models.User.find({
        _id: {
            $in: users
        }
    }, function (err, users) {
        if (err) {
            return cb(err);
        }

        cb(null, users);
    });
};