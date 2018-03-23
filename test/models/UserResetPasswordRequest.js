var assert = require('assert');

var moment = require('moment');
var mongoose = require('mongoose');

var db = require('../../models');

var UserResetPasswordRequest = db.models.UserResetPasswordRequest;

var requiredFields = [
    'user', 'email',
    'code', 'expires_at',
    'created_at'
];

describe('models.UserResetPasswordRequest', function () {
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
        var userResetPasswordRequest = new UserResetPasswordRequest();
        var now = moment(new Date()).format('YYYY-MM-DD');

        assert.strictEqual(moment(userResetPasswordRequest.created_at).format('YYYY-MM-DD'),
                           now);
    });

    it('validates that required fields are set', function (done) {
        var userResetPasswordRequest = new UserResetPasswordRequest();

        requiredFields.forEach(function (field) {
            userResetPasswordRequest[field] = null;
        });

        userResetPasswordRequest.validate(function (err) {
            /* Make sure model throws an error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (['expires_at', 'created_at'].indexOf(field) !== -1) {
                    userResetPasswordRequest[field] = new Date();

                    return;
                }

                userResetPasswordRequest[field] = mongoose.Types.ObjectId();
            });

            userResetPasswordRequest.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
});