var db = require('../../models');

module.exports = function (phoneNumberIDs, cb) {
    db.models.PhoneNumber.remove({_id: {
        $in: phoneNumberIDs
    }}, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};