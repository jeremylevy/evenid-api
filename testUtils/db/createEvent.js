var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (event, cb) {
    db.models.Event.create(event, function (err, event) {
        if (err) {
            return cb(err);
        }

        cb(null, event);
    });
};