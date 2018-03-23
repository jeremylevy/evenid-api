var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (clientID, userID, 
                           pendingNotifications,
                           pendingNotificationsAreProcessed,
                           cb) {
    
    var insert = {    
        client: clientID,
        user: userID,
        pending_notifications: pendingNotifications
    };

    if (pendingNotificationsAreProcessed) {
        insert.processed_at = new Date();
    } else {
        insert.processed_at = new Date(0);
    }

    db.models.OauthNotification.create(insert, function (err, oauthNotification) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthNotification);
    });
};