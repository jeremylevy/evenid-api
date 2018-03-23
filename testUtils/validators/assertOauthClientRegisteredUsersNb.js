var assert = require('assert');
var moment = require('moment-timezone');

var findOauthClients = require('../db/findOauthClients');
var findOauthClientRegisteredUsersAtDate = require('../db/findOauthClientRegisteredUsersAtDate');

module.exports = function (clientID, nb, cb) {
    var today = moment.tz(new Date(), 'UTC')
                      .startOf('day')
                      .toDate();

    findOauthClients([clientID], function (err, clients) {
        var client = clients && clients[0];

        if (err) {
            return cb(err);
        }

        assert.strictEqual(clients.length, 1);

        assert.strictEqual(client.statistics.registered_users, nb);

        findOauthClientRegisteredUsersAtDate(clientID, today, function (err, registeredUsers) {
            var registeredUser = registeredUsers && registeredUsers[0];

            if (err) {
                return cb(err);
            }

            // Registered users record may not exists
            if (nb === 0) {
                assert.ok(registeredUsers.length <= 1);
            } else {
                assert.strictEqual(registeredUsers.length, 1);
            }

            if (!registeredUsers.length) {
                return cb(null);
            }

            assert.strictEqual(registeredUser.count, nb);
            assert.strictEqual(registeredUser.previous_count, 0);

            cb(null);
        });
    });
};