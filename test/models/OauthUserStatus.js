var assert = require('assert');

var mongoose = require('mongoose');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var OauthUserStatus = db.models.OauthUserStatus;

var validOauthUserStatus = function () {
    oauthUserStatus = new OauthUserStatus();

    oauthUserStatus.user = mongoose.Types.ObjectId();
    oauthUserStatus.client = mongoose.Types.ObjectId();
    oauthUserStatus.status = 'new_user';

    return oauthUserStatus;
};

var requiredFields = [
    'user', 'client',
    'status', 'use_test_account'
];

describe('models.OauthUserStatus', function () {
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
        var oauthUserStatus = new OauthUserStatus();
        
        assert.strictEqual(oauthUserStatus.use_test_account, false);

        /* Make sure default is 
           applied to `updated_fields` field */

        oauthUserStatus.updated_emails = [{
            id: mongoose.Types.ObjectId(),
            status: 'new'
        }];

        oauthUserStatus.updated_phone_numbers = [{
            id: mongoose.Types.ObjectId(),
            status: 'new'
        }];

        oauthUserStatus.updated_addresses = [{
            id: mongoose.Types.ObjectId(),
            status: 'new'
        }];


        /* `toObject()`: Get a real JS array */

        assert.deepEqual(oauthUserStatus.updated_fields
                                        .toObject(), []);

        assert.deepEqual(oauthUserStatus.updated_emails[0]
                                        .updated_fields
                                        .toObject(), []);

        assert.deepEqual(oauthUserStatus.updated_phone_numbers[0]
                                        .updated_fields
                                        .toObject(), []);

        assert.deepEqual(oauthUserStatus.updated_addresses[0]
                                        .updated_fields
                                        .toObject(), []);
    });

    it('validates that required fields are set', function (done) {
        var oauthUserStatus = new OauthUserStatus();

        requiredFields.forEach(function (field) {
            oauthUserStatus[field] = null;
        });

        oauthUserStatus.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */

            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (field === 'status') {
                    return oauthUserStatus[field] = 'new_user';
                }

                oauthUserStatus[field] = mongoose.Types.ObjectId();
            });

            oauthUserStatus.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates status', function (done) {
        var oauthUserStatus = validOauthUserStatus();

        oauthUserStatus.status = 'bar';

        oauthUserStatus.validate(function (err) {
            assert.strictEqual(err.errors.status.name, 'ValidatorError');

            /* Make sure model validation 
               pass when status is valid */

            oauthUserStatus.status = 'new_user';

            oauthUserStatus.validate(function (err) {
                assert.ok(!err);

                oauthUserStatus.status = 'existing_user';

                oauthUserStatus.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    it('validates updated fields', function (done) {
        var oauthUserStatus = validOauthUserStatus();

        oauthUserStatus.updated_fields = ['bar'];

        oauthUserStatus.validate(function (err) {
            assert.strictEqual(err.errors.updated_fields.name, 'ValidatorError');

            /* Make sure model validation 
               pass when updated fields are valid */

            oauthUserStatus.updated_fields = ['emails'];

            oauthUserStatus.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('ensures that user has only one status per client', function (done) {
        var oauthUserStatus = validOauthUserStatus();
        var user = null;
        var client = null;

        user = oauthUserStatus.user;
        client = oauthUserStatus.client;

        oauthUserStatus.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthUserStatus = validOauthUserStatus();

            // Reuse the same user and client
            oauthUserStatus.user = user;
            oauthUserStatus.client = client;

            oauthUserStatus.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});