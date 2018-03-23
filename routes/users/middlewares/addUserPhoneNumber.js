var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (req, res, next) {
    var context = this;
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var body = usedDuringOauthAuthorize ? context.body : req.body;

    var phoneType = validator.trim(body.phone_type);
    var number = validator.trim(body.number);
    var country = validator.trim(body.country);

    var user = res.locals.user;
    var userID = !usedDuringOauthAuthorize && req.params[0];

    var paramsToInsert = {
        user: user.id,
        number: number,
        country: country
    };

    if (phoneType) {
        paramsToInsert.phone_type = phoneType;
    }

    // Check that user is access token user
    if (!usedDuringOauthAuthorize 
        && user.id !== userID) {

        return next(new AccessDeniedError());
    }

    if (user.phone_numbers.length >= config.EVENID_USERS.MAX_ENTITIES.PHONE_NUMBERS) {
        return next(new AccessDeniedError('You have reached the maximum number '
                                        + 'of phone numbers allowed per user.'));
    }

    async.auto({
        addPhoneNumber: function (cb) {
            db.models.PhoneNumber.create(paramsToInsert, function (err, phoneNumber) {
                if (err) {
                    return cb(err);
                }

                cb(null, phoneNumber);
            });
        },

        attachPhoneNumberToUser: ['addPhoneNumber', function (cb, results) {
            var phoneNumber = results.addPhoneNumber;

            user.phone_numbers.push(phoneNumber._id);

            // Make sure user will be saved
            // event if phone numbers array is populated
            user.markModified('phone_numbers');

            user.save(function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        }]
    }, function (err, results) {
        var phoneNumber = results && results.addPhoneNumber;

        if (err) {
            return next(err);
        }

        // `next` was mocked
        if (usedDuringOauthAuthorize) {
            return next(null, phoneNumber);
        }

        res.send(phoneNumber.toObject());
    });
};