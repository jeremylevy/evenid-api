var crypto = require('crypto');
var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    db.models.Photo.create({
        sid: crypto.createHash('sha1')
                   .update(mongoose.Types.ObjectId().toString())
                   .digest('hex')
    }, function (err, photo) {
        if (err) {
            return cb(err);
        }

        cb(null, photo);
    });
};