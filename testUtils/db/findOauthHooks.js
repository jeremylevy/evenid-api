var db = require('../../models');

module.exports = function (hooks, cb) {
    db.models.OauthHook.find({
        _id: {
            $in: hooks
        }
    }, function (err, hooks) {
        if (err) {
            return cb(err);
        }

        cb(null, hooks);
    });
};