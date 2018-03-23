var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var localesData = require('../../../locales/data');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/phone-numbers/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];
        var phoneNumberID = req.params[1];

        var currentLocale = req.i18n.getLocale();
        var territories = localesData[currentLocale].territories;

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own phone number
            || !user.ownPhoneNumber(phoneNumberID)) {
            
            return next(new AccessDeniedError());
        }

        async.auto({
            findPhoneNumber: function (cb) {
                var query = db.models.PhoneNumber.findById(phoneNumberID, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    if (!phoneNumber) {
                        return cb(new NotFoundError());
                    }

                    cb(null, phoneNumber);
                });
            }
        }, function (err, results) {
            var phoneNumber = results && results.findPhoneNumber;

            if (err) {
                return next(err);
            }

            res.send({
                phoneNumber: phoneNumber.toObject(),
                territories: territories
            });
        });
    });
};