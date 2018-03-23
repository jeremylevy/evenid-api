var Type = require('type-of-is');

var db = require('../../models');

module.exports = function (clientsID, usersID, cb) {
    var context = this;
    var wantsSingleValue = false;

    if (!Type.is(usersID, Array)) {
        usersID = [usersID];
        wantsSingleValue = true;
    }

    if (!Type.is(clientsID, Array)) {
        clientsID = [clientsID];
    }

    db.models.OauthNotification.find({
        client: {
            $in: clientsID
        },
        user: {
            $in: usersID
        }
    }, null, {
        // Raw results?
        lean: !!context.lean
    }, function (err, oauthNotification) {
        if (err) {
            return cb(err);
        }

        if (wantsSingleValue) {
            return cb(null, oauthNotification[0]);
        }

        cb(null, oauthNotification);
    });
};