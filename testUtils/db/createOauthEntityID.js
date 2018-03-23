var db = require('../../models');

module.exports = function (entity, cb) {
    db.models.OauthEntityID.create(entity, function (err, entityID) {
        if (err) {
            return cb(err);
        }

        cb(null, entityID);
    });
};