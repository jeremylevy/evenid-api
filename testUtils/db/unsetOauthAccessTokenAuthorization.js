var mongoose = require('mongoose');

var updateAccessToken = require('./updateAccessToken');

module.exports = function (accessToken, cb) {
    updateAccessToken({
        token: accessToken
    }, {
        // authorization is required so replace it
        // with a falsy value
        authorization: mongoose.Types.ObjectId()
    }, function (err) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};