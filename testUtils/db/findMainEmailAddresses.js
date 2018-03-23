var async = require('async');

var findUsers = require('./findUsers');
var findEmails = require('./findEmails');

module.exports = function (userID, cb) {
    async.auto({
        findUser: function (cb) {
            findUsers([userID], function (err, users) {
                if (err) {
                    return cb(err);
                }

                cb(null, users[0]);
            });
        },

        findMainEmailAddresses: ['findUser', function (cb, results) {
            var user = results.findUser;

            findEmails(user.emails, function (err, emails) {
                var mainEmailAddresses = [];

                if (err) {
                    return cb(err);
                }

                emails.forEach(function (email) {
                    if (!email.is_main_address) {
                        return;
                    }

                    mainEmailAddresses.push(email);
                })

                cb(null, mainEmailAddresses);
            });
        }]
    }, function (err, results) {
        var mainEmailAddresses = results && results.findMainEmailAddresses;

        if (err) {
            return cb(err);
        }

        cb(null, mainEmailAddresses);
    });
};