var db = require('../../models');

module.exports = function (redirectionURIs, cb) {
    db.models.OauthRedirectionURI.find({
        _id: {
            $in: redirectionURIs
        }
    }, function (err, redirectionURIs) {
        if (err) {
            return cb(err);
        }

        cb(null, redirectionURIs);
    });
};