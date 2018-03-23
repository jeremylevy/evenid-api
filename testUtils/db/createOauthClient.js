var crypto = require('crypto');
var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;

    var validID = function () {
        return mongoose.Types
                       .ObjectId()
                       .toString();
    };

    var validSha1 = function () {
        return crypto.createHash('sha1')
                     .update(validID())
                     .digest('hex');
    };

    db.models.OauthClient.create(context.client || {    
        client_id: validID(),
        client_secret: validSha1(),
        
        name: validID(),
        logo: validSha1(),
        
        description: validID(),
        website: 'http://' + validID() + '.com',
        
        redirection_uris: context.redirection_uris || [],
        hooks: context.hooks || [],
        
        update_notification_handler: context.update_notification_handler || undefined,

        statistics: context.statistics || undefined
    }, function (err, client) {
        if (err) {
            return cb(err);
        }

        cb(null, client);
    });
};