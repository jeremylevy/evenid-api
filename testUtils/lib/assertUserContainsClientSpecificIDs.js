var assert = require('assert');
var async = require('async');

var findUsers = require('../db/findUsers');
var findEmails = require('../db/findEmails');
var findPhoneNumbers = require('../db/findPhoneNumbers');
var findAddresses = require('../db/findAddresses');

var findOauthEntitiesID = require('../db/findOauthEntitiesID');

var assertTestUserContainsClientSpecificIDs = require('./assertTestUserContainsClientSpecificIDs');

var compareArray = require('./compareArray');

module.exports = function (clientID, userID, returnedUser, cb) {
    var args = Array.prototype.slice.call(arguments);

    var getEntityID = function (v) {
        return v.id;
    };

    var fakeUserID = returnedUser.id;
    var realUserID = null;

    var fakeEmailIDs = [];
    var realEmailIDs = [];

    var fakePhoneNumberIDs = [];
    var realPhoneNumberIDs = [];

    var fakeAddressIDs = [];
    var realAddressIDs = [];

    var fakeIDs = [fakeUserID];

    if (returnedUser.is_test_account) {
        return assertTestUserContainsClientSpecificIDs.apply(this, args);
    }

    if (returnedUser.emails) {
        fakeEmailIDs = returnedUser.emails.map(getEntityID);
    }

    if (returnedUser.phone_numbers) {
        fakePhoneNumberIDs = returnedUser.phone_numbers.map(getEntityID);
    }

    if (returnedUser.addresses) {
        fakeAddressIDs = returnedUser.addresses.map(getEntityID);
    }

    fakeIDs = fakeIDs.concat(fakeEmailIDs, fakePhoneNumberIDs, fakeAddressIDs);

    async.auto({
        assertFakeIDsExist: function (cb) {
            findOauthEntitiesID({
                client: clientID,
                user: userID,
                fake_id: {
                    $in: fakeIDs
                }
            }, function (err, oauthEntitiesID) {
                var oauthEntitiesIDs = [];
                var _fakeUserID = null;
                var _fakeEmailIDs = [];
                var _fakePhoneNumberIDs = [];
                var _fakeAddressIDs = [];

                if (err) {
                    return cb(err);
                }

                oauthEntitiesID.forEach(function (entityID) {
                    if (entityID.entities[0] === 'emails') {

                        realEmailIDs.push(entityID.real_id.toString());
                        _fakeEmailIDs.push(entityID.fake_id.toString());

                    } else if (['unknown_phone_numbers', 
                                'mobile_phone_numbers', 
                                'landline_phone_numbers'].indexOf(entityID.entities[0]) !== -1) {

                        realPhoneNumberIDs.push(entityID.real_id.toString());
                        _fakePhoneNumberIDs.push(entityID.fake_id.toString());

                    } else if ('addresses' === entityID.entities[0]) {

                        realAddressIDs.push(entityID.real_id.toString());
                        _fakeAddressIDs.push(entityID.fake_id.toString());

                    } else if ('users' === entityID.entities[0]) {
                        realUserID = entityID.real_id.toString();
                        _fakeUserID = entityID.fake_id.toString();
                    }
                });

                assert.strictEqual(oauthEntitiesID.length,
                                   fakeIDs.length);

                assert.strictEqual(fakeUserID, _fakeUserID);

                assert.ok(compareArray(fakeEmailIDs, _fakeEmailIDs));
                assert.ok(compareArray(fakePhoneNumberIDs, _fakePhoneNumberIDs));
                assert.ok(compareArray(fakeAddressIDs, _fakeAddressIDs));

                cb(null, oauthEntitiesID);
            });
        },

        assertFakeUserIDDoesntExist: function (cb) {
            findUsers([fakeUserID], function (err, users) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(users.length, 0);

                cb(null, users);
            });
        },

        assertRealUserIDExist: ['assertFakeIDsExist', function (cb, results) {
            findUsers([realUserID], function (err, users) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(users.length, 1);

                cb(null, users);
            });
        }],

        assertFakeEmailIDsDoesntExist: function (cb) {
            findEmails(fakeEmailIDs, function (err, emails) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(emails.length, 0);

                cb(null, emails);
            });
        },

        assertRealEmailIDExist: ['assertFakeIDsExist', function (cb, results) {
            findEmails(realEmailIDs, function (err, emails) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(emails.length,
                                   realEmailIDs.length);

                cb(null, emails);
            });
        }],

        assertFakePhoneNumberIDsDoesntExist: function (cb) {
            findPhoneNumbers(fakePhoneNumberIDs, function (err, phoneNumbers) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(phoneNumbers.length, 0);

                cb(null, phoneNumbers);
            });
        },

        assertRealPhoneNumberIDsExist: ['assertFakeIDsExist', function (cb, results) {
            findPhoneNumbers(realPhoneNumberIDs, function (err, phoneNumbers) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(phoneNumbers.length,
                                   realPhoneNumberIDs.length);

                cb(null, phoneNumbers);
            });
        }],

        assertFakeAddressIDsDoesntExist: function (cb) {
            findAddresses(fakeAddressIDs, function (err, addresses) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(addresses.length, 0);

                cb(null, addresses);
            });
        },

        assertRealAddressIDsExist: ['assertFakeIDsExist', function (cb, results) {
            findAddresses(realAddressIDs, function (err, addresses) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(addresses.length,
                                   realAddressIDs.length);

                cb(null, addresses);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb();
    });
};