var assert = require('assert');

var moment = require('moment');
var mongoose = require('mongoose');

var db = require('../../models');

var OauthClientRegisteredUser = db.models.OauthClientRegisteredUser;

var requiredFields = [
    'client', 'count',
    'previous_count',
    'at'
];

describe('models.OauthClientRegisteredUser', function () {
    // Connect to database
    before(function (done) {
        require('../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('validates that required fields are set', function (done) {
        var oauthClientRegisteredUser = new OauthClientRegisteredUser();

        requiredFields.forEach(function (field) {
            oauthClientRegisteredUser[field] = null;
        });

        oauthClientRegisteredUser.validate(function (err) {
            /* Make sure model throws an error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (['at'].indexOf(field) !== -1) {
                    oauthClientRegisteredUser[field] = new Date();

                    return;
                }

                if (['client'].indexOf(field) !== -1) {
                    oauthClientRegisteredUser[field] = mongoose.Types.ObjectId();

                    return;
                }

                // Any number for `count` and `previous_count`
                oauthClientRegisteredUser[field] = 1;
            });

            oauthClientRegisteredUser.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
});