var assert = require('assert');
var crypto = require('crypto');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var createEmail = require('../../testUtils/db/createEmail');
var createTestUser = require('../../testUtils/db/createTestUser');

var TestUser = db.models.TestUser;
var validTestUser = function () {
    var testUser = new TestUser({
        user: mongoose.Types.ObjectId(),
        client: mongoose.Types.ObjectId()
    });

    return testUser;
};

var uniqueEmail = function () {
    return new db.models.Email({
        address: mongoose.Types.ObjectId().toString() + '@evenid.com',
        user: mongoose.Types.ObjectId()
    });
};

var requiredFields = ['user', 'client'];

describe('models.TestUser', function () {
    // Connect to database
    before(function (done) {
        require('../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('applies default values', function () {
        var testUser = new TestUser();

        // `toObject()`: Get a real JS array
        assert.deepEqual(testUser.sent_fields.toObject(), []);
    });

    it('has virtual properties', function (done) {
        async.auto({
            createEmail: function (cb) {
                createEmail(function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            // Make sure `email` virtual property
            // only returns main address
            createEmail2: function (cb) {
                createEmail.call({
                    isMainAddress: false
                }, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createTestUser: ['createEmail', 'createEmail2', function (cb, results) {
                var email = results.createEmail;
                var email2 = results.createEmail2;

                createTestUser.call({
                    emails: [email, email2]
                }, function (err, testUser) {
                    if (err) {
                        return done(err);
                    }

                    cb(null, testUser);
                });
            }]
        }, function (err, results) {
            var testUser = results.createTestUser;
            var email = results.createEmail;
            var gravatarReg = null;

            if (err) {
                return done(err);
            }
            
            gravatarReg = new RegExp('^' + config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                                         + '/users/profil-photos/default'
                                   + '$');

            assert.strictEqual(testUser.email, email.address);
            
            assert.ok(gravatarReg.test(testUser.gravatar));

            done();
        });
    });

    it('validates that required fields are set', function (done) {
        var testUser = new TestUser();

        requiredFields.forEach(function (field) {
            testUser[field] = null;
        });

        testUser.validate(function (err) {
            /* Make sure model throw error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation pass 
               when all required fields are set */
            
            requiredFields.forEach(function (field) {
                testUser[field] = mongoose.Types.ObjectId();
            });

            testUser.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates gender', function (done) {
        var testUser = validTestUser();

        testUser.gender = 'bar';

        testUser.validate(function (err) {
            assert.strictEqual(err.errors.gender.name, 'ValidatorError');

            /* Make sure model validation 
               pass when gender is valid */

            testUser.gender = 'female';

            testUser.validate(function (err) {
                assert.ok(!err);

                testUser.gender = 'male';

                testUser.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    it('validates that nickname is not already used', function (done) {
        var testUser = validTestUser();
        var nickname = mongoose.Types.ObjectId().toString();

        testUser.nickname = nickname;
        // Avoid duplicate key error index: 
        // test.testusers.$emails.address_1  dup key: { : null }
        testUser.emails = [uniqueEmail()];

        testUser.save(function (err) {
            if (err) {
                return done(err);
            }

            testUser = validTestUser();

            // We reuse the same nickname than above
            testUser.nickname = nickname;
            // Avoid duplicate key error index: 
            // test.testusers.$emails.address_1  dup key: { : null }
            testUser.emails = [uniqueEmail()];

            testUser.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });

    it('validates `sent_fields` field', function (done) {
        var testUser = validTestUser();

        testUser.sent_fields = ['bar'];

        testUser.validate(function (err) {
            assert.strictEqual(err.errors.sent_fields.name, 'ValidatorError');

            /* Make sure model validation 
               pass when sent fields are valid */

            testUser.sent_fields = ['emails'];

            testUser.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    /* Emails, phone numbers and addresses are tested separatly
       in their respective model */
});