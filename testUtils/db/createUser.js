var db = require('../../models');

module.exports = function (cb) {
    var context = this;
    var user = context.user || {
        password: 'azerty'
    };

    db.models.User.create(user, function (err, user) {
        if (err) {
            return cb(err);
        }
        
        cb(null, user);
    });
};