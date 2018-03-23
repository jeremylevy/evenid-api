var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var libphonenumber = require('node-phonenumber');

var validator = require('validator');

var config = require('../../../config');

var localesData = require('../../../locales/data');

var findOrCreateTestUser = require('../../../models/actions/findOrCreateTestUser');

var createTestUser = require('../../../testUtils/db/createTestUser');
var findOauthEntitiesID = require('../../../testUtils/db/findOauthEntitiesID');

var isValidTimezone = require('../../../models/validators/isValidTimezone');
var isValidAlpha2CountryCode = require('../../../models/validators/isValidAlpha2CountryCode');

describe('models.actions.findOrCreateTestUser', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-locale as user locale', function () {
        [null, undefined, {}, 9, [], 'en', 'us'].forEach(function (v) {
            assert.throws(function () {
                findOrCreateTestUser(v, 
                                     mongoose.Types.ObjectId(), 
                                     mongoose.Types.ObjectId(), 
                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOrCreateTestUser('en-us',
                                     v, 
                                     mongoose.Types.ObjectId(), 
                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOrCreateTestUser('en-us',
                                     mongoose.Types.ObjectId(), 
                                     v, 
                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                findOrCreateTestUser('en-us',
                                     mongoose.Types.ObjectId(), 
                                     mongoose.Types.ObjectId(), 
                                     v);
            }, assert.AssertionError);
        });
    });

    it('returns test user when it was previously created', function (done) {
        createTestUser(function (err, createdTestUser) {
            if (err) {
                return done(err);
            }

            findOrCreateTestUser('en-us', createdTestUser.user, 
                                 createdTestUser.client, function (err, testUser) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(createdTestUser.id, testUser.id);

                done();
            });
        });
    });

    it('creates test user when not exist', function (done) {
        // (732) 757-2923
        var phoneNumberReg = /^(\+|\(|\s)[0-9)\s-]+/;
        var isValidAddress = function (addressToCheck, validAddress) {
            for (var key in validAddress) {
                assert.strictEqual(validAddress[key], addressToCheck[key]);
            }
        };

        var fnNB = config.EVENID_LOCALES.ENABLED.length;

        // Test user differs according to locale 
        // so add test for each enabled locale
        config.EVENID_LOCALES.ENABLED.forEach(function (locale) {
            var addresses = localesData[locale].addresses;
            var userID = mongoose.Types.ObjectId();
            var clientID = mongoose.Types.ObjectId();
            var phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();

            findOrCreateTestUser(locale, userID, clientID, function (err, testUser) {
                var number = null;

                if (err) {
                    return done(err);
                }

                assert.strictEqual(testUser.user, userID);
                assert.strictEqual(testUser.client, clientID);

                assert.ok(validator.isEmail(testUser.emails[0].address));
                
                assert.ok(testUser.first_name.length > 0);
                assert.ok(testUser.last_name.length > 0);
                assert.ok(testUser.nickname.length > 0);

                assert.ok(testUser.profil_photo.length > 0);
                assert.ok(['male', 'female'].indexOf(testUser.gender) !== -1);
                assert.ok(Type.is(testUser.date_of_birth, Date));

                assert.ok(isValidAlpha2CountryCode(testUser.place_of_birth));
                assert.ok(isValidAlpha2CountryCode(testUser.nationality));

                assert.ok(isValidTimezone(testUser.timezone));

                ['mobile_phone_numbers', 
                 'landline_phone_numbers'].forEach(function (property) {

                    number = phoneUtil.parseAndKeepRawInput(testUser[property][0].number, 
                                                            testUser[property][0].country);

                    assert.ok(phoneUtil.isValidNumberForRegion(number, 
                                                               testUser[property][0].country));

                 });

                isValidAddress(testUser.addresses[0], addresses[0]);

                fnNB--;

                if (fnNB === 0) {
                    done();
                }
            });
        });
    });
    
    it('creates entities ID when test account was created', function (done) {
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        findOrCreateTestUser(config.EVENID_LOCALES.ENABLED[0], 
                             userID, clientID, function (err, testUser) {
            if (err) {
                return done(err);
            }

            findOauthEntitiesID({
                user: userID,
                client: clientID
            }, function (err, oauthEntitiesID) {
                if (err) {
                    return done(err);
                }

                // emails, mobile/landline, addresses
                assert.strictEqual(oauthEntitiesID.length, 4);

                oauthEntitiesID.forEach(function (oauthEntityID) {
                    var entity = oauthEntityID.entities[0];

                    // Test account use same number 
                    // for mobile and unknown
                    if (entity === 'unknown_phone_numbers') {
                        entity = 'mobile_phone_numbers';
                    }

                    assert.strictEqual(oauthEntityID.real_id.toString(), 
                                       testUser[entity][0].id.toString());
                });

                done();
            })
        });
    });
});