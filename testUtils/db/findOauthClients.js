var db = require('../../models');

module.exports = function (clients, cb) {
    db.models.OauthClient.find({
        _id: {
            $in: clients
        }
    }, function (err, clients) {
        if (err) {
            return cb(err);
        }

        cb(null, clients);
    });
};