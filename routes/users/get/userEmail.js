var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/emails/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];
        var emailID = req.params[1];

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own email
            || !user.ownEmail(emailID)) {
            
            return next(new AccessDeniedError());
        }

        async.auto({
            findEmail: function (cb) {
                var query = db.models.Email.findById(emailID, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    if (!email) {
                        return cb(new NotFoundError());
                    }

                    cb(null, email);
                });
            }
        }, function (err, results) {
            var email = results && results.findEmail;

            if (err) {
                return next(err);
            }

            res.send(email.toObject());
        });
    });
};