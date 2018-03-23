var db = require('../../models');

module.exports = function (addresses, cb) {
    db.models.Address.find({
        _id: {
            $in: addresses
        }
    }, function (err, addresses) {
        if (err) {
            return cb(err);
        }

        cb(null, addresses);
    });
};