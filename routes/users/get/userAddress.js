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
                            + ')/addresses/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];
        var addressID = req.params[1];

        var currentLocale = req.i18n.getLocale();
        var territories = localesData[currentLocale].territories;

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own address
            || !user.ownAddress(addressID)) {

            return next(new AccessDeniedError());
        }

        async.auto({
            findAddress: function (cb) {
                var query = db.models.Address.findById(addressID, function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    if (!address) {
                        return cb(new NotFoundError());
                    }

                    cb(null, address);
                });
            }
        }, function (err, results) {
            var address = results && results.findAddress;

            if (err) {
                return next(err);
            }

            res.send({
                address: address.toObject(), 
                territories: territories
            });
        });
    });
};