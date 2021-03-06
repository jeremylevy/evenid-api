var updateResetPasswordRequest = require('./updateResetPasswordRequest');

module.exports = function (code, cb) {
    var expiredDate = new Date();

    // January 1, 1970
    expiredDate.setTime(0);

    updateResetPasswordRequest({
        code: code
    }, {
        expires_at: expiredDate
    }, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};