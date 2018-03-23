var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var resetOauthUserStatusForDeletedEntity = require('./resetOauthUserStatusForDeletedEntity');

var NotFoundError = require('../../errors/types/NotFoundError');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (addressID, userID, cb) {
    // `areValidObjectIDs` check for 
    // the `addressID` type and its emptiness
    assert.ok(areValidObjectIDs([addressID]),
              'argument `addressIDs` must be an array of ObjectIDs');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        removeAddress: function (cb) {
            // Pre remove middleware needs to be called,
            // so we must use remove function on a document.
            db.models.Address.findById(addressID, function (err, address) {
                if (err) {
                    return cb(err);
                }

                if (!address) {
                    return cb(new NotFoundError());
                }

                address.remove(cb);
            });
        },

        // Pull addresses from user's addresses
        updateAddressesForUser: ['removeAddress', function (cb, results) {
            db.models.User.findByIdAndUpdate(userID, {
                $pull: { 
                    addresses: addressID
                }
            }, {
                // Get updated user
                new: true
            }, function (err, updatedUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, updatedUser);
            });
        }],

        pullFromOauthAuthorizations: ['removeAddress', function (cb, results) {
            db.models.OauthAuthorization.update({
                issued_for: userID,
                'user.addresses.address': addressID
            }, {
                $pull: { 
                    'user.addresses': {
                        address: addressID
                    }
                }
            }, {
                multi: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        pullFromUserAuthorizations: ['removeAddress', function (cb, results) {
            db.models.UserAuthorization.update({
                user: userID,
                'entities.addresses': addressID
            }, {
                $pull: { 
                    'entities.addresses': addressID
                }
            }, {
                multi: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Remove address from `updated_address`
        // for clients which have not seen this 
        // email (ie: status set to `new`)
        resetOauthUserStatus: ['removeAddress', function (cb, results) {
            resetOauthUserStatusForDeletedEntity(userID, 'addresses',
                                                 addressID, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        var updatedUser = results && results.updateAddressesForUser;

        if (err) {
            return cb(err);
        }

        cb(null, updatedUser);
    });
};