var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;

    db.models.PhoneNumber.create({
        number: context.number || '0638749389',
        country: context.country || 'FR',
        phone_type: context.phoneType || undefined,
        user: context.user || mongoose.Types.ObjectId()
    }, function (err, phoneNumber) {
        if (err) {
            return cb(err);
        }

        cb(null, phoneNumber);
    });
};