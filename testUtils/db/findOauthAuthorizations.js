var db = require('../../models');

module.exports = function (authorizations, cb) {
    var context = this;
    var findConditions = context.findConditions;

    db.models.OauthAuthorization.find(findConditions || {
        _id: {
            $in: authorizations
        }
    }, function (err, authorizations) {
        if (err) {
            return cb(err);
        }

        cb(null, authorizations);
    });
};