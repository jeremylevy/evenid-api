var db = require('../../models');

module.exports = function (validateEmailRequests, cb) {
    var context = this;

    db.models.UserValidateEmailRequest.find(context.findConditions || {
        _id: {
            $in: validateEmailRequests
        }
    }, function (err, validateEmailRequests) {
        if (err) {
            return cb(err);
        }

        cb(null, validateEmailRequests);
    });
};