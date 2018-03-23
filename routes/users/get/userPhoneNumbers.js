var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var localesData = require('../../../locales/data');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/phone-numbers$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];

        var currentLocale = req.i18n.getLocale();
        var territories = localesData[currentLocale].territories;

        // Check that user is access token user
        if (user.id !== userID) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findPhoneNumbers: function (cb) {
                db.models.PhoneNumber.find({
                    _id: {
                        $in: user.phone_numbers
                    }
                }, null, {
                    sort: {
                        _id: 1
                    }
                }, function (err, phoneNumbers) {
                    var phoneNumbersAsRawObj = [];

                    if (err) {
                        return cb(err);
                    }

                    for (var i = 0, j = phoneNumbers.length; i < j; ++i) {
                        phoneNumbersAsRawObj.push(phoneNumbers[i].toObject());
                    }

                    cb(null, phoneNumbersAsRawObj);
                });
            }
        }, function (err, results) {
            var phoneNumbers = results && results.findPhoneNumbers;

            if (err) {
                return next(err);
            }

            res.send({
                phoneNumbers: phoneNumbers,
                territories: territories
            });
        });
    });
};