var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/emails$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;
        var userID = req.params[0];

        // Check that user is access token user
        if (user.id !== userID) {
            return next(new AccessDeniedError());
        }
        
        async.auto({
            findEmails: function (cb) {
                db.models.Email.find({
                    _id: {
                        // Email addresses were populated
                        // to access gravatar.
                        $in: user.emails.toObject({
                            depopulate: true
                        })
                    }
                }, null, {
                    sort: {
                        _id: 1
                    }
                }, function (err, emails) {
                    var emailsAsRawObj = [];

                    if (err) {
                        return cb(err);
                    }

                    for (var i = 0, j = emails.length; i < j; ++i) {
                        emailsAsRawObj.push(emails[i].toObject());
                    }

                    cb(null, emailsAsRawObj);
                });
            }
        }, function (err, results) {
            var emails = results && results.findEmails;

            if (err) {
                return next(err);
            }

            res.send(emails);
        });
    });
};