var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (oauthAuthorization, cb) {
    db.models.OauthAuthorization.create(oauthAuthorization, function (err, oauthAuthorization) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthAuthorization);
    });
};