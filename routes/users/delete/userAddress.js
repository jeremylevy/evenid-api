var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var findUserAuthorizations = require('../../../models/actions/findUserAuthorizations');
var removeAddress = require('../../../models/actions/removeAddress');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')/addresses/('
                            + config.EVENID_MONGODB
                                    .OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app'), function (req, res, next) {
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
            findUserAuthorizations: function (cb) {
                // Get all clients which use this address
                findUserAuthorizations('addresses', 
                                       addressID, 
                                       user._id, 
                                       function (err, userAuthorizations) {

                    if (err) {
                        return cb(err);
                    }

                    // Get all clients which use ONLY this address
                    userAuthorizations = userAuthorizations.filter(function (userAuthorization) {
                        return userAuthorization.entities.addresses.length === 1;
                    });

                    if (userAuthorizations.length > 0) {
                        return cb(
                            new AccessDeniedError('You must unsubscribe from all applications '
                                                  + 'that use only this address before deleting it.')
                        );
                    }

                    cb(null, userAuthorizations);
                });
            },

            deleteAddress: ['findUserAuthorizations', function (cb, results) {
                removeAddress(addressID, userID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }]
        }, function (err, results) {
            if (err) {
                return next(err);
            }
            
            res.send({});
        });
    });
};