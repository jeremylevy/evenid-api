var assert = require('assert');

var moment = require('moment');
var mongoose = require('mongoose');

var db = require('../../models');

var OauthClientTestAccount = db.models.OauthClientTestAccount;

var requiredFields = [
    'client', 'count.registered',
    'count.converted',
    'previous_count.registered',
    'previous_count.converted',
    'at'
];

describe('models.OauthClientTestAccount', function () {
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
        var oauthClientTestAccount = new OauthClientTestAccount();

        requiredFields.forEach(function (field) {
            oauthClientTestAccount[field.split('.')[0]] = null;
        });

        oauthClientTestAccount.validate(function (err) {
            /* Make sure model throws an error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (['at'].indexOf(field) !== -1) {
                    oauthClientTestAccount[field] = new Date();

                    return;
                }

                if (['client'].indexOf(field) !== -1) {
                    oauthClientTestAccount[field] = mongoose.Types.ObjectId();

                    return;
                }

                // Any number for `count` and `previous_count`
                oauthClientTestAccount[field.split('.')[0]] = {
                    registered: 1,
                    converted: 0
                };
            });

            oauthClientTestAccount.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
});