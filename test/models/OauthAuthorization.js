var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var db = require('../../models');

var OauthAuthorization = db.models.OauthAuthorization;

var requiredFields = ['type', 'scope', 'needs_client_secret'];

describe('models.OauthAuthorization', function () {
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
        var oauthAuthorization = new OauthAuthorization();

        // Make sure default apply to for value
        oauthAuthorization.user.addresses = [{
            address: mongoose.Types.ObjectId()
        }];

        assert.strictEqual(oauthAuthorization.code.is_used, false);
        assert.strictEqual(oauthAuthorization.needs_client_secret, true);

        /* `toObject()`: Get a real JS array */

        assert.deepEqual(oauthAuthorization.scope.toObject(), []);
        assert.deepEqual(oauthAuthorization.scope_flags.toObject(), []);
    });

    it('validates that required fields are set', function (done) {
        var oauthAuthorization = new OauthAuthorization();

        requiredFields.forEach(function (requiredField) {
            oauthAuthorization[requiredField] = null;
        });

        oauthAuthorization.validate(function (err) {
            // Make sure models throw error when required fields
            // are not set
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            // Make sure model validation pass when all required
            // fields are set
            oauthAuthorization.type = 'authorization_code';
            oauthAuthorization.scope = ['emails'];
            oauthAuthorization.needs_client_secret = false;

            oauthAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates authorization type', function (done) {
        var oauthAuthorization = new OauthAuthorization();

        oauthAuthorization.type = 'foo';
        oauthAuthorization.scope = ['emails'];

        oauthAuthorization.validate(function (err) {
            assert.strictEqual(err.errors.type.name, 'ValidatorError');

            /* Make sure model validation 
               pass when authorization type is valid */

            oauthAuthorization.type = 'authorization_code';

            oauthAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates scope', function (done) {
        var oauthAuthorization = new OauthAuthorization();

        oauthAuthorization.type = 'authorization_code';
        oauthAuthorization.scope = ['bar'];

        oauthAuthorization.validate(function (err) {
            assert.strictEqual(err.errors.scope.name, 'ValidatorError');

            /* Make sure model validation 
               pass when scope is valid */

            oauthAuthorization.scope = ['emails', 'first_name'];

            oauthAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates scope flags', function (done) {
        var oauthAuthorization = new OauthAuthorization();

        oauthAuthorization.type = 'authorization_code';
        oauthAuthorization.scope = ['phone_numbers'];
        oauthAuthorization.scope_flags = ['bar'];

        oauthAuthorization.validate(function (err) {
            assert.strictEqual(err.errors.scope_flags.name, 'ValidatorError');

            /* Make sure model validation 
               pass when scope flags are valid */

            oauthAuthorization.scope_flags = ['mobile_phone_number'];

            oauthAuthorization.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('has methods', function () {
        var oauthAuthorization = new OauthAuthorization();

        assert.ok(Type.is(oauthAuthorization.hasAppScope, Function));
    });
});