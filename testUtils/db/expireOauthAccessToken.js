var updateAccessToken = require('./updateAccessToken');

module.exports = function (accessToken, cb) {
    var expiredDate = new Date();

    // January 1, 1970
    expiredDate.setTime(0);

    updateAccessToken({
        token: accessToken
    }, {
        expires_at: expiredDate
    }, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};