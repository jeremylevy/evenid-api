var db = require('../../models');

module.exports = function (addressIDs, cb) {
    db.models.Address.remove({_id: {
        $in: addressIDs
    }}, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};