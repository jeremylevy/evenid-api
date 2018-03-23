var assert = require('assert');

var mongoose = require('mongoose');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var OauthNotification = db.models.OauthNotification;

var validOauthNotification = function () {
    oauthNotification = new OauthNotification();

    oauthNotification.user = mongoose.Types.ObjectId();
    oauthNotification.client = mongoose.Types.ObjectId();

    return oauthNotification;
};

var requiredFields = [
    'user', 'client', 'processed_at'
];

describe('models.OauthNotification', function () {
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
        var oauthNotification = new OauthNotification();
        
        assert.strictEqual(oauthNotification.processed_at.getTime(),
                           0);
    });

    it('validates that required fields are set', function (done) {
        var oauthNotification = new OauthNotification();

        requiredFields.forEach(function (field) {
            oauthNotification[field] = null;
        });

        oauthNotification.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */

            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (field === 'processed_at') {
                    oauthNotification[field] = new Date();

                    return;
                }
                
                oauthNotification[field] = mongoose.Types.ObjectId();
            });

            oauthNotification.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('ensures that user has only one entity per client', function (done) {
        var oauthNotification = validOauthNotification();
        
        var user = null;
        var client = null;

        user = oauthNotification.user;
        client = oauthNotification.client;

        oauthNotification.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthNotification = validOauthNotification();

            // Reuse the same user and client
            oauthNotification.user = user;
            oauthNotification.client = client;

            oauthNotification.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});