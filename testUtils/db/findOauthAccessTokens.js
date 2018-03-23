var db = require('../../models');

module.exports = function (accessTokens, cb) {
    var context = this;
    var query = db.models.OauthAccessToken.find(context.findConditions || {
        _id: {
            $in: accessTokens
        }
    });

    if (context.populateAuthorization) {
        query.populate('authorization');
    }

    query.exec(function (err, accessTokens) {
        if (err) {
            return cb(err);
        }

        cb(null, accessTokens);
    });
};