var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;

    db.models.OauthRedirectionURI.create({
        uri: context.uri || 'http://' + mongoose.Types.ObjectId().toString() + '.com',
        response_type: context.responseType || 'code',
        scope: context.scope || ['emails'],
        client: context.client || mongoose.Types.ObjectId()
    }, function (err, redirectionURI) {
        if (err) {
            return cb(err);
        }

        cb(null, redirectionURI);
    });
};