var assert = require('assert');

var async = require('async');

var db = require('../../../models');

var populateUserAuthorizationEntities = require('../../../models/actions/populateUserAuthorizationEntities');

var createEmail = require('../../../testUtils/db/createEmail');
var createPhoneNumber = require('../../../testUtils/db/createPhoneNumber');
var createAddress = require('../../../testUtils/db/createAddress');

describe('models.actions.populateUserAuthorizationEntities', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid user authorization', function () {
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                populateUserAuthorizationEntities(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                populateUserAuthorizationEntities(new db.models.UserAuthorization(), v);
            }, assert.AssertionError);
        });
    });

    it('returns empty object model when no entities were passed', function (done) {
        populateUserAuthorizationEntities(new db.models.UserAuthorization(), function (err, userAuthorization) {
            if (err) {
                return done(err);
            }

            /* `toObject()` to get real JS array */

            assert.deepEqual(userAuthorization.entities.emails.toObject(), []);
            assert.deepEqual(userAuthorization.entities.phone_numbers.toObject(), []);
            assert.deepEqual(userAuthorization.entities.addresses.toObject(), []);

            done();
        });
    });

    it('returns populated object model when all entities were passed', function (done) {
        var addressFor = ['unknown'];

        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createPhoneNumber: function (cb) {
                createPhoneNumber(function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            },

            createAddress: function (cb) {
                createAddress(function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            },

            populateUserAuthorizationEntities: ['createEmail', 
                                                'createAddress', 
                                                'createPhoneNumber', function (cb, results) {
                
                var email = results.createEmail;
                var phoneNumber = results.createPhoneNumber;
                var address = results.createAddress;

                var userAuthorization = new db.models.UserAuthorization({
                    entities: {
                        emails: [email.id],
                        phone_numbers: [phoneNumber.id],
                        addresses: [address.id]
                    }
                });

                populateUserAuthorizationEntities(userAuthorization, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }]
        }, function (err, results) {
            var email = results && results.createEmail;
            var phoneNumber = results && results.createPhoneNumber;
            var address = results && results.createAddress;
            var userAuthorization = results && results.populateUserAuthorizationEntities;

            if (err) {
                return done(err);
            }

            assert.strictEqual(userAuthorization.entities.emails[0].address, 
                               email.address);
            
            assert.strictEqual(userAuthorization.entities.phone_numbers[0].number, 
                               phoneNumber.number);
            
            assert.strictEqual(userAuthorization.entities.addresses[0].address_line_1, 
                               address.address_line_1);
            
            done();
        });
    });
});