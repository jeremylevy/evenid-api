var db = require('../../models');

module.exports = function (emails, cb) {
    db.models.Email.find({
        _id: {
            $in: emails
        }
    }, function (err, emails) {
        if (err) {
            return cb(err);
        }

        cb(null, emails);
    });
};