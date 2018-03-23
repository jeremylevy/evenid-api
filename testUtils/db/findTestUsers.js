var db = require('../../models');

module.exports = function (clientID, usersID, cb) {
    db.models.TestUser.find({
        client: clientID,
        user: {
            $in: usersID
        }
    }, function (err, testUsers) {
        if (err) {
            return cb(err);
        }

        cb(null, testUsers);
    });
};