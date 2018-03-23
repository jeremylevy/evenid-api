var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');

var populateGrantedAuthorizations = require('../../../../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var createUser = require('../../../../../testUtils/db/createUser');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

describe('models.middlewares.pre.validate.populateGrantedAuthorizations (Update entity)', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('populates `_granted_authorizations` field for non-user entity', function (done) {
        async.auto({
            // We create the user
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            },

            // We attach a phone number to it
            createPhoneNumber: ['createUser', function (cb, results) {
                var user = results.createUser;

                createPhoneNumber.call({
                    user: user.id
                }, function (err, phoneNumber) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, phoneNumber);
                });
            }],

            // We give access to phone number for client
            createUserAuthorization: ['createPhoneNumber', function (cb, results) {
                var user = results.createUser;
                var phoneNumber = results.createPhoneNumber;

                createUserAuthorization.call({
                    user: user,
                    entities: {
                        phone_numbers: [phoneNumber.id]
                    }
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            // Create another authorization to ensure that
            // granted authorizations contains 
            // only authorizations that have this phone number ID
            createUserAuthorization2: ['createPhoneNumber', function (cb, results) {
                var user = results.createUser;

                createUserAuthorization.call({
                    user: user,
                    entities: {
                        phone_numbers: [mongoose.Types.ObjectId()]
                    }
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            assertItHasPopulatedGrantedAuth: ['createUserAuthorization', 
                                              'createUserAuthorization2',
                                              function (cb, results) {
                
                var phoneNumber = results.createPhoneNumber;
                var userAuthorization = results.createUserAuthorization;

                populateGrantedAuthorizations('phone_numbers').call(phoneNumber, function () {
                    assert.ok(Type.is(phoneNumber._granted_authorizations, Array));

                    assert.strictEqual(phoneNumber._granted_authorizations.length, 1);

                    // Make sure returned authorization 
                    // is the one which have the phone number ID
                    assert.strictEqual(phoneNumber._granted_authorizations[0].id,
                                       userAuthorization.id);

                    // Make sure client was populated
                    assert.ok('update_notification_handler' 
                              in phoneNumber._granted_authorizations[0].client);

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});