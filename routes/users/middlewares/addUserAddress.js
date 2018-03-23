var async = require('async');
var validator = require('validator');
var Type = require('type-of-is');

var config = require('../../../config');

var db = require('../../../models');

var authorizeAccessToEntity = require('../../../models/actions/authorizeAccessToEntity');
var findUserAuthorizations = require('../../../models/actions/findUserAuthorizations');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (req, res, next) {
    var context = this;
    var usedDuringOauthAuthorize = context && context.name === 'oauthAuthorize';

    var body = usedDuringOauthAuthorize ? context.body : req.body;

    var addressType = validator.trim(body.address_type);
    var fullName = validator.trim(body.full_name);

    // Remove point from right side of address line
    var addressLine1 = validator.rtrim(validator.trim(body.address_line_1), ['.']);
    var addressLine2 = validator.rtrim(validator.trim(body.address_line_2), ['.']);

    var accessCode = validator.trim(body.access_code);
    var city = validator.trim(body.city);
    var state = validator.trim(body.state);
    var postalCode = validator.trim(body.postal_code);
    var country = validator.trim(body.country);

    var user = res.locals.user;
    var userID = !usedDuringOauthAuthorize && req.params[0];

    // Check that the user ID set in URL
    // is access token user
    if (!usedDuringOauthAuthorize 
        && user.id !== userID) {

        return next(new AccessDeniedError());
    }

    if (user.addresses.length >= config.EVENID_USERS
                                       .MAX_ENTITIES.ADDRESSES) {
        return next(new AccessDeniedError('You have reached the maximum number '
                                        + 'of addresses allowed per user.'));
    }

    async.auto({
        addAddress: function (cb) {
            db.models.Address.create({
                user: user.id,
                full_name: fullName,
                address_line_1: addressLine1,
                address_line_2: addressLine2,
                access_code: accessCode,
                city: city,
                state: state,
                postal_code: postalCode,
                country: country,
                address_type: addressType
            }, function (err, address) {
                if (err) {
                    return cb(err);
                }

                cb(null, address);
            });
        },

        attachAddressToUser: ['addAddress', function (cb, results) {
            var address = results.addAddress;

            user.addresses.push(address._id);

            // Make sure user will be saved
            // event if addresses array is populated
            user.markModified('addresses');

            user.save(function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        }]
    }, function (err, results) {
        var address = results && results.addAddress;

        if (err) {
            return next(err);
        }

        if (usedDuringOauthAuthorize) {
            return next(null, address);
        }

        res.send(address.toObject());
    });
};