var async = require('async');
var moment = require('moment-timezone');

var db = require('../../models');

module.exports = function (userID, clientID, nb, cb) {
    var today = moment.tz(new Date(), 'UTC')
                      .startOf('day')
                      .toDate();

    async.auto({
        updateOauthClient: function (cb) {
            db.models.OauthClient.findByIdAndUpdate(clientID, {
                $inc: {
                    'statistics.registered_users': nb
                }
            }, {
                select: 'statistics'
            }, function (err, oldOauthClient) {
                if (err) {
                    return cb(err);
                }

                cb(null, oldOauthClient);
            });
        },

        updateOauthClientRegisteredUsers: ['updateOauthClient', function (cb, results) {
            var oldOauthClient = results.updateOauthClient;

            var previousCount = oldOauthClient.statistics.registered_users || 0;
            var newCount = previousCount + nb;
            
            db.models.OauthClientRegisteredUser.update({
                client: clientID,
                at: today
            }, {
                count: newCount,
                // Previous count must be
                // previous day count
                $setOnInsert: {
                    previous_count: previousCount
                }
            }, {
                // Whether to create the doc 
                // if it doesn't exist
                upsert: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};