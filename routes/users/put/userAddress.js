var Type = require('type-of-is');

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
                            + ')/addresses/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN 
                            + ')$');

    app.put(uriReg, checkScope('app'), function (req, res, next) {
        var addressType = !Type.is(req.body.address_type, undefined) 
                            ? validator.trim(req.body.address_type) 
                            : undefined;

        var fullName = !Type.is(req.body.full_name, undefined) 
                        ? validator.trim(req.body.full_name) 
                        : undefined;

        // Remove point from right side of address line
        var addressLine1 = !Type.is(req.body.address_line_1, undefined) 
                            ? validator.rtrim(validator.trim(req.body.address_line_1), ['.']) 
                            : undefined;
        var addressLine2 = !Type.is(req.body.address_line_2, undefined)
                            ? validator.rtrim(validator.trim(req.body.address_line_2), ['.'])
                            : undefined;

        var accessCode = !Type.is(req.body.access_code, undefined) 
                            ? validator.trim(req.body.access_code)
                            : undefined;

        var city = !Type.is(req.body.city, undefined) 
                    ? validator.trim(req.body.city)
                    : undefined;

        var state = !Type.is(req.body.state, undefined) 
                        ? validator.trim(req.body.state)
                        : undefined;

        var postalCode = !Type.is(req.body.postal_code, undefined) 
                            ? validator.trim(req.body.postal_code)
                            : undefined;

        var country = !Type.is(req.body.country, undefined) 
                        ? validator.trim(req.body.country)
                        : undefined;

        var user = res.locals.user;
        var userID = req.params[0];

        var addressID = req.params[1];

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
            },

            updateAddress: ['findAddress', function (cb, results) {
                var address = results.findAddress;

                if (!Type.is(addressType, undefined)) {
                    address.address_type = addressType;
                }

                if (!Type.is(fullName, undefined)) {
                    address.full_name = fullName;
                }

                if (!Type.is(addressLine1, undefined)) {
                    address.address_line_1 = addressLine1;
                }

                if (!Type.is(addressLine2, undefined)) {
                    address.address_line_2 = addressLine2;
                }

                if (!Type.is(accessCode, undefined)) {
                    address.access_code = accessCode;
                }

                if (!Type.is(city, undefined)) {
                    address.city = city;
                }

                if (!Type.is(state, undefined)) {
                    address.state = state;
                }

                if (!Type.is(postalCode, undefined)) {
                    address.postal_code = postalCode;
                }

                if (!Type.is(country, undefined)) {
                    address.country = country;
                }

                address.save(function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                })
            }]
        }, function (err, results) {
            var address = results && results.updateAddress;

            if (err) {
                return next(err);
            }

            res.send(address.toObject());
        });
    });
};