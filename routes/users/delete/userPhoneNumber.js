var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var findUserAuthorizations = require('../../../models/actions/findUserAuthorizations');
var removePhoneNumbers = require('../../../models/actions/removePhoneNumbers');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/phone-numbers/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];
        var phoneNumberID = req.params[1];

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own phone number
            || !user.ownPhoneNumber(phoneNumberID)) {

            return next(new AccessDeniedError());
        }

        async.auto({
            findUserAuthorizations: function (cb) {
                findUserAuthorizations('phone_numbers', 
                                        phoneNumberID, 
                                        user._id, 
                                        function (err, authorizations) {
                    if (err) {
                        return cb(err);
                    }

                    if (authorizations.length > 0) {
                        return cb(
                            new AccessDeniedError('You must unsubscribe from all applications that '
                                                  + 'use this phone number before deleting it.')
                        );
                    }

                    cb(null, authorizations);
                });
            },

            findPhoneNumber: ['findUserAuthorizations', function (cb, results) {
                var query = db.models.PhoneNumber.findById(phoneNumberID, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    if (!phoneNumber) {
                        return cb(new NotFoundError());
                    }

                    cb(null, phoneNumber);
                });
            }],

            deletePhoneNumber: ['findPhoneNumber', function (cb, results) {
                var phoneNumber = results.findPhoneNumber;
                
                removePhoneNumbers([phoneNumber._id], user._id, function (err, updatedUser) {
                    cb(err);
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