var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');
var Charlatan = require('charlatan');

var config = require('../../config');

var db = require('../');

var localesData = require('../../locales/data');

var insertOauthEntitiesID = require('./insertOauthEntitiesID');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (userLocale, userID, clientID, cb) {
    assert.ok(Type.is(userLocale, String) 
              && userLocale.match(/^[a-z]{2}-[a-z]{2}$/),
              'argument `userLocale` must be valid locale');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var timezones = localesData[userLocale].timezones;

    var addresses = localesData[userLocale].addresses;
    var phoneNumbers = localesData[userLocale].phoneNumbers;

    async.auto({
        findTestUser: function (cb) {
            db.models.TestUser.findOne({
                user: userID,
                client: clientID
            }, function (err, testUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, testUser);
            });
        },

        createTestUser: ['findTestUser', function (cb, results) {
            var testUser = results.findTestUser;

            // It's the locale the client uses when calling the GET API method
            var userCountry = userLocale.split('-')[1].toUpperCase();
            var address = addresses[0];

            var getRandomID = function () {
                return mongoose.Types.ObjectId().toString();
            };
            // Between 1 jan 1970 and 19 sept 2000
            var randomDateOfBirth = new Date(Charlatan.Helpers.rand(0, 969385429 * 1000));

            // Make sure date hour is set to '0'
            // Hours, minutes, secondes, ms
            randomDateOfBirth.setHours(0, 0, 0, 0);

            // Address entity 
            // needs user owner property
            address.user = userID;

            // Test user was alreay created
            // Pass to call to ease process
            // in main callback
            if (testUser) {
                return cb(null, testUser);
            }

            db.models.TestUser.create({
                user: userID,
                client: clientID,

                emails: [new db.models.Email({
                    user: userID,
                    // Needs to be unique
                    address: 'test_' + getRandomID() + '@evenid.com',
                    // For Gravatar
                    is_main_address: true,
                    is_verified: true
                })],

                first_name: 'Test',

                last_name: 'Test',

                // Needs to be unique
                nickname: 'test_' + getRandomID(),

                // Will be set to gravatar
                profil_photo: undefined,

                // Random
                gender: Charlatan.Helpers.sample(['male', 'female']),

                // Between 1 jan 1970 and 19 sept 2000
                date_of_birth: randomDateOfBirth,
                
                place_of_birth: userCountry,
                nationality: userCountry,
                
                timezone: Charlatan.Helpers.sample(['Europe/Paris', 'America/New_York']),

                mobile_phone_numbers: [new db.models.PhoneNumber({
                    user: userID,
                    number: phoneNumbers.mobile[0],
                    country: userCountry,
                    // Some countriy numbers (US for example) 
                    // cannot be inferred
                    phone_type: 'mobile'
                })],

                landline_phone_numbers: [new db.models.PhoneNumber({
                    user: userID,
                    number: phoneNumbers.landline[0],
                    country: userCountry,
                    // Same than above
                    phone_type: 'landline'
                })],

                addresses: [new db.models.Address(address)]
            }, function (err, testUser) {
                if (err) {
                    return cb(err);
                }

                cb(null, testUser);
            });
        }],

        // We must keep the same id when user register
        // for real after testing
        insertOauthEntitiesId: ['createTestUser', function (cb, results) {
            var foundTestUser = results.findTestUser;
            var testUser = results.createTestUser;
            var authorizedEntities = {
                use_test_account: true
            };

            // Test user was alreay created
            if (foundTestUser) {
                return cb(null);
            }

            // Entity ID for the user ID 
            // has been inserted during oauth authorize flow

            authorizedEntities.emails = [testUser.emails[0].id];

            // We reuse mobile number given that some 
            // countries (like FR) doesn't have unknown numbers
            authorizedEntities.unknown_phone_numbers = [
                testUser.mobile_phone_numbers[0].id
            ];
            authorizedEntities.mobile_phone_numbers = [
                testUser.mobile_phone_numbers[0].id, 
            ];
            authorizedEntities.landline_phone_numbers = [
                testUser.landline_phone_numbers[0].id
            ];

            authorizedEntities.addresses = [
                testUser.addresses[0].id
            ];

            insertOauthEntitiesID(authorizedEntities, userID, 
                                  clientID, function (err) {
                
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        var testUser = results && results.createTestUser;

        if (err) {
            return cb(err);
        }

        cb(null, testUser);
    });
};