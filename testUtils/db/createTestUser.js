var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;
    var testUser = {
        user: context.userID || mongoose.Types.ObjectId(),
        client: context.clientID || mongoose.Types.ObjectId(),
        emails: context.emails || [new db.models.Email({
            address: mongoose.Types.ObjectId().toString() + '@evenid.com',
            user: mongoose.Types.ObjectId()
        })],
        // Needs to be unique
        nickname: 'test_' + mongoose.Types.ObjectId().toString()
    };

    db.models.TestUser.create(testUser, function (err, testUser) {
        if (err) {
            return cb(err);
        }

        cb(null, testUser);
    });
};