var db = require('../../models');

module.exports = function (clientID, date, cb) {
    db.models.OauthClientRegisteredUser.find({
        client: clientID,
        at: date
    }, function (err, registeredUsers) {
        if (err) {
            return cb(err);
        }

        cb(null, registeredUsers);
    });
};