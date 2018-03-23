var db = require('../../models');

module.exports = function (conditions, cb) {
    db.models.OauthEntityID.find(conditions, 
                                 function (err, oauthEntitiesID) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthEntitiesID);
    });
};