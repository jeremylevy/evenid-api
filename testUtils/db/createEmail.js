var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;

    db.models.Email.create({
        address: mongoose.Types.ObjectId().toString() + '@evenid.com',
        // May be set to `false`
        is_main_address: 'isMainAddress' in context ? context.isMainAddress : true,
        // May be set to `false`
        is_verified: 'isVerified' in context ? context.isVerified : true,
        user: context.user || mongoose.Types.ObjectId()
    }, function (err, email) {
        if (err) {
            return cb(err);
        }

        cb(null, email);
    });
};