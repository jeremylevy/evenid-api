var assert = require('assert');
var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var OauthEntityID = db.models.OauthEntityID;
var validEntityID = function (oauthEntityID) {
    requiredFields.forEach(function (field) {
        var value = mongoose.Types.ObjectId();

        if (field === 'entities') {
            value = ['users'];
        }

        if (field === 'use_test_account') {
            value = false;
        }
        
        oauthEntityID[field] = value;
    });

    return oauthEntityID;
};

var requiredFields = [
    'user', 'client', 
    'real_id', 'fake_id', 
    'entities', 'use_test_account'
];

describe('models.OauthEntityID', function () {
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
        var oauthEntityID = new OauthEntityID();

        assert.strictEqual(oauthEntityID.use_test_account, false);
    });

    it('validates that required fields are set', function (done) {
        var oauthEntityID = new OauthEntityID();

        requiredFields.forEach(function (field) {
            oauthEntityID[field] = null;
        });

        oauthEntityID.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation pass 
               when all required fields are set */

            oauthEntityID = validEntityID(oauthEntityID);

            oauthEntityID.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates entities', function (done) {
        var oauthEntityID = new OauthEntityID();

        oauthEntityID = validEntityID(oauthEntityID);
        oauthEntityID.entities = ['foo'];

        oauthEntityID.validate(function (err) {
            assert.strictEqual(err.errors.entities.name, 'ValidatorError');

            /* Make sure model validation 
               pass when entities iare valid */

            oauthEntityID.entities = ['mobile_phone_numbers'];

            oauthEntityID.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that `user.client.real_id` are unique', function (done) {
        var oauthEntityID = validEntityID(new OauthEntityID());
        var user = null;
        var client = null;
        var real = null;

        user = oauthEntityID.user;
        client = oauthEntityID.client;
        realID = oauthEntityID.real_id;

        oauthEntityID.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthEntityID = validEntityID(new OauthEntityID());

            // Reuse the same user, client and real ID
            oauthEntityID.user = user;
            oauthEntityID.client = client;
            oauthEntityID.real_id = realID;

            oauthEntityID.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});