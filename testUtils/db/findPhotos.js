var db = require('../../models');

module.exports = function (photos, cb) {
    db.models.Photo.find({
        sid: {
            $in: photos
        }
    }, function (err, photos) {
        if (err) {
            return cb(err);
        }

        cb(null, photos);
    });
};