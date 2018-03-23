var assert = require('assert');
var async = require('async');

var findUsers = require('../db/findUsers');
var findEmails = require('../db/findEmails');
var findPhoneNumbers = require('../db/findPhoneNumbers');
var findAddresses = require('../db/findAddresses');
var findTestUsers = require('../db/findTestUsers');

var findOauthEntitiesID = require('../db/findOauthEntitiesID');

var compareArray = require('./compareArray');

module.exports = function (clientID, userID, returnedUser, cb) {
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
                },
                use_test_account: true
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

        findTestUser: ['assertFakeIDsExist', function (cb, results) {
            findTestUsers(clientID, [userID], function (err, testUsers) {
                var testUser = testUsers[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(testUsers.length, 1);

                cb(null, testUser);
            });
        }],

        assertFakeUserIDDoesntExist: ['findTestUser', function (cb) {
            findUsers([fakeUserID], function (err, users) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(users.length, 0);

                cb(null, users);
            });
        }],

        // User ID does not correspond to
        // anything at time test account is used
        /*assertRealUserIDExist: ['findTestUser', function (cb, results) {
            findUsers([realUserID], function (err, users) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(users.length, 1);

                cb(null, users);
            });
        }],*/

        assertFakeEmailIDsDoesntExist: ['findTestUser', function (cb) {
            findEmails(fakeEmailIDs, function (err, emails) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(emails.length, 0);

                cb(null, emails);
            });
        }],

        assertRealEmailIDExist: ['findTestUser', function (cb, results) {
            var testUser = results.findTestUser;
            var emailIDs = testUser.emails.map(getEntityID);

            // We don't use compare array here because test user entity
            // is always fully filled, so it may have more emails
            // than returned.
            realEmailIDs.forEach(function (realEmailID) {
                assert.ok(emailIDs.indexOf(realEmailID) !== -1);
            });

            cb(null);
        }],

        assertFakePhoneNumberIDsDoesntExist: ['findTestUser', function (cb) {
            findPhoneNumbers(fakePhoneNumberIDs, function (err, phoneNumbers) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(phoneNumbers.length, 0);

                cb(null, phoneNumbers);
            });
        }],

        assertRealPhoneNumberIDsExist: ['findTestUser', function (cb, results) {
            var testUser = results.findTestUser;
            var phoneNumbers = [].concat(
                testUser.mobile_phone_numbers,
                testUser.landline_phone_numbers
            );
            var phoneNumberIDs = phoneNumbers.map(getEntityID);

            // We don't use compare array here because test user entity
            // is always fully filled, so it may have more phone numbers
            // than returned.
            realPhoneNumberIDs.forEach(function (realPhoneNumberID) {
                assert.ok(phoneNumberIDs.indexOf(realPhoneNumberID) !== -1);
            });

            cb(null);
        }],

        assertFakeAddressIDsDoesntExist: ['findTestUser', function (cb) {
            findAddresses(fakeAddressIDs, function (err, addresses) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(addresses.length, 0);

                cb(null, addresses);
            });
        }],

        assertRealAddressIDsExist: ['findTestUser', function (cb, results) {
            var testUser = results.findTestUser;
            var addressIDs = testUser.addresses.map(getEntityID);

            // We don't use compare array here because test user entity
            // is always fully filled, so it may have more addresses
            // than returned.
            realAddressIDs.forEach(function (realAddressID) {
                assert.ok(addressIDs.indexOf(realAddressID) !== -1);
            });

            cb(null);
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb();
    });
};