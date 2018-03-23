var db = require('../../models');

module.exports = function (resetPasswordRequests, cb) {
    db.models.UserResetPasswordRequest.find({
        _id: {
            $in: resetPasswordRequests
        }
    }, function (err, resetPasswordRequests) {
        if (err) {
            return cb(err);
        }

        cb(null, resetPasswordRequests);
    });
};