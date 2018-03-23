var mongoose = require('mongoose');

var db = require('../../models');

module.exports = function (cb) {
    var context = this;

    db.models.Address.create({
        full_name: 'Sheldon Cooper',
        address_line_1: '725 passadena east street',
        city: 'San Francisco',
        postal_code: '76373',
        country: 'US',
        address_type: 'residential',
        user: context.user || mongoose.Types.ObjectId()
    }, function (err, address) {
        if (err) {
            return cb(err);
        }

        cb(null, address);
    });
};