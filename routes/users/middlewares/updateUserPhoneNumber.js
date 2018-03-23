var Type = require('type-of-is');

var async = require('async');
var validator = require('validator');

var db = require('../../../models');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (req, res, next) {
    var context = this;
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var body = usedDuringOauthAuthorize ? context.body : req.body;

    var phoneType = !Type.is(body.phone_type, undefined)
                     ? validator.trim(body.phone_type)
                     : undefined;

    var number = !Type.is(body.number, undefined)
                    ? validator.trim(body.number)
                    : undefined;

    var country = !Type.is(body.country, undefined)
                    ? validator.trim(body.country)
                    : undefined;

    var user = res.locals.user;
    var userID = !usedDuringOauthAuthorize && req.params[0];

    var phoneNumberID = usedDuringOauthAuthorize 
        ? context.phoneNumberID 
        : req.params[1];

    // Check that user is access token user
    if (!usedDuringOauthAuthorize 
         && user.id !== userID
        // Check that user own phone number
        || !user.ownPhoneNumber(phoneNumberID)) {
        
        return next(new AccessDeniedError());
    }

    async.auto({
        findPhoneNumber: function (cb) {
            db.models.PhoneNumber.findById(phoneNumberID, function (err, phoneNumber) {
                if (err) {
                    return cb(err);
                }

                if (!phoneNumber) {
                    return cb(new NotFoundError());
                }

                cb(null, phoneNumber);
            });
        },

        updatePhoneNumber: ['findPhoneNumber', function (cb, results) {
            var phoneNumber = results.findPhoneNumber;
            
            if (!Type.is(number, undefined)
                && phoneNumber.number !== number) {
                
                phoneNumber.number = number;
            }

            if (!Type.is(phoneType, undefined)) {
                phoneNumber.phone_type = phoneType;
            }

            if (!Type.is(country, undefined)) {
                phoneNumber.country = country;
            }

            phoneNumber.save(function (err, phoneNumber) {
                if (err) {
                    return cb(err);
                }

                cb(null, phoneNumber);
            });
        }]
    }, function (err, results) {
        var phoneNumber = results && results.updatePhoneNumber;

        if (err) {
            return next(err);
        }

        if (usedDuringOauthAuthorize) {
            return next(null, phoneNumber);
        }

        res.send(phoneNumber.toObject());
    });
};