var db = require('../../models');

module.exports = function (phoneNumbers, cb) {
    db.models.PhoneNumber.find({
        _id: {
            $in: phoneNumbers
        }
    }, function (err, phoneNumbers) {
        if (err) {
            return cb(err);
        }

        cb(null, phoneNumbers);
    });
};