var assert = require('assert');

var mongoose = require('mongoose');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var UserAuthorization = db.models.UserAuthorization;
var validUserAuthorization = function () {
    return new UserAuthorization({
        user: mongoose.Types.ObjectId(),
        client: mongoose.Types.ObjectId(),
        scope: ['emails']
    });
};

var requiredFields = ['user', 'client', 'scope'];

describe('models.UserAuthorization', function () {
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
        var userAuthorization = new UserAuthorization();

        /* `toObject()`: Get a real JS array */

        assert.deepEqual(userAuthorization.scope.toObject(), []);
        assert.deepEqual(userAuthorization.scope_flags.toObject(), []);
    });

    it('validates that required fields are set', function (done) {
        var userAuthorization = new UserAuthorization();

        requiredFields.forEach(function (field) {
            userAuthorization[field] = null;
        });

        userAuthorization.validate(function (err) {
            /* Make sure model throws an error 
               when required fields are not set */

            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                userAuthorization[field] = (field === 'scope') 
                    ? ['emails'] 
                    : mongoose.Types.ObjectId();
            });

            userAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates scope', function (done) {
        var userAuthorization = validUserAuthorization();

        userAuthorization.scope = ['bar'];

        userAuthorization.validate(function (err) {
            assert.strictEqual(err.errors.scope.name, 'ValidatorError');

            /* Make sure model validation 
               pass when scope is valid */

            userAuthorization.scope = ['emails', 'first_name'];

            userAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates scope flags', function (done) {
        var userAuthorization = validUserAuthorization();

        userAuthorization.scope_flags = ['bar'];

        userAuthorization.validate(function (err) {
            assert.strictEqual(err.errors.scope_flags.name, 'ValidatorError');

            /* Make sure model validation 
               pass when scope flags are valid */

            userAuthorization.scope_flags = ['mobile_phone_number'];

            userAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('ensures that user has only one authorization per client', function (done) {
        var userAuthorization = validUserAuthorization();
        var user = null;
        var client = null;

        user = userAuthorization.user;
        client = userAuthorization.client;

        userAuthorization.save(function (err) {
            if (err) {
                return done(err);
            }

            userAuthorization = validUserAuthorization();

            // Reuse the same user and client
            userAuthorization.user = user;
            userAuthorization.client = client;

            userAuthorization.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});