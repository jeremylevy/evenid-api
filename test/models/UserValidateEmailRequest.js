var assert = require('assert');

var moment = require('moment');
var mongoose = require('mongoose');

var db = require('../../models');

var UserValidateEmailRequest = db.models.UserValidateEmailRequest;

var requiredFields = [
    'user', 'email',
    'code', 'expires_at',
    'created_at'
];

describe('models.UserValidateEmailRequest', function () {
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
        var userValidateEmailRequest = new UserValidateEmailRequest();
        var now = moment(new Date()).format('YYYY-MM-DD');

        assert.strictEqual(moment(userValidateEmailRequest.created_at).format('YYYY-MM-DD'),
                           now);
    });

    it('validates that required fields are set', function (done) {
        var userValidateEmailRequest = new UserValidateEmailRequest();

        requiredFields.forEach(function (field) {
            userValidateEmailRequest[field] = null;
        });

        userValidateEmailRequest.validate(function (err) {
            /* Make sure model throws an error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (['expires_at', 'created_at'].indexOf(field) !== -1) {
                    userValidateEmailRequest[field] = new Date();

                    return;
                }

                userValidateEmailRequest[field] = mongoose.Types.ObjectId();
            });

            userValidateEmailRequest.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
});