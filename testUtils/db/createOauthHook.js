var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;

    db.models.OauthHook.create({
        client: context.client || mongoose.Types.ObjectId(),
        url: context.url || 'http://' + mongoose.Types.ObjectId().toString() + '.com',
        event_type: context.eventType || 'USER_DID_REVOKE_ACCESS'
    }, function (err, hook) {
        if (err) {
            return cb(err);
        }

        cb(null, hook);
    });
};