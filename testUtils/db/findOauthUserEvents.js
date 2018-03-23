var db = require('../../models');

module.exports = function (conditions, cb) {
    db.models.OauthUserEvent.find(conditions, 
                                 function (err, oauthUserEvents) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthUserEvents);
    });
};