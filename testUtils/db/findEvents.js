var db = require('../../models');

module.exports = function (events, cb) {
    db.models.Event.find({
        _id: {
            $in: events
        }
    }, function (err, events) {
        if (err) {
            return cb(err);
        }

        cb(null, events);
    });
};