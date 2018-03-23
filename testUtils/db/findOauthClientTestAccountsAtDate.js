var db = require('../../models');

module.exports = function (clientID, date, cb) {
    db.models.OauthClientTestAccount.find({
        client: clientID,
        at: date
    }, function (err, testAccounts) {
        if (err) {
            return cb(err);
        }

        cb(null, testAccounts);
    });
};