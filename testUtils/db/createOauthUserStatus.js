var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (clientID, userID, status, useTestAccount, cb) {
    var context = this;
    var insert = {    
        client: clientID,
        user: userID,
        status: status,
        use_test_account: useTestAccount
    };

    if (context.insert) {
        Object.keys(context.insert).forEach(function (insertKey) {
            insert[insertKey] = context.insert[insertKey];
        });
    }

    db.models.OauthUserStatus.create(insert, function (err, oauthUserStatus) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthUserStatus);
    });
};