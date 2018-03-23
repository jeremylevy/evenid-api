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
                            + ')/addresses$');

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
            findAddresses: function (cb) {
                db.models.Address.find({
                    _id: {
                        $in: user.addresses
                    }
                }, null, {
                    sort: {
                        _id: 1
                    }
                }, function (err, addresses) {
                    var addressesAsRawObj = [];

                    if (err) {
                        return cb(err);
                    }

                    for (var i = 0, j = addresses.length; i < j; ++i) {
                        addressesAsRawObj.push(addresses[i].toObject());
                    }

                    cb(null, addressesAsRawObj);
                });
            }
        }, function (err, results) {
            var addresses = results && results.findAddresses;

            if (err) {
                return next(err);
            }

            res.send({
                addresses: addresses,
                territories: territories
            });
        });
    });
};