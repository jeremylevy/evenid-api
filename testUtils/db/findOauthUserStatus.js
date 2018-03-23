var Type = require('type-of-is');

var db = require('../../models');

module.exports = function (clientsID, usersID, cb) {
    var wantsSingleValue = false;

    if (!Type.is(usersID, Array)) {
        usersID = [usersID];
        wantsSingleValue = true;
    }

    if (!Type.is(clientsID, Array)) {
        clientsID = [clientsID];
    }

    db.models.OauthUserStatus.find({
        client: {
            $in: clientsID
        },
        user: {
            $in: usersID
        }
    }, function (err, userStatus) {
        if (err) {
            return cb(err);
        }

        if (wantsSingleValue) {
            return cb(null, userStatus[0]);
        }

        cb(null, userStatus);
    });
};