var Type = require('type-of-is');

var db = require('../../models');

module.exports = function (usersID, cb) {
    var context = this;

    if (!Type.is(usersID, Array)) {
        usersID = [usersID];
    }

    db.models.UserAuthorization.find(context.findConditions || {
        user: {
            $in: usersID
        }
    }, function (err, authorizations) {
        if (err) {
            return cb(err);
        }

        cb(null, authorizations);
    });
};