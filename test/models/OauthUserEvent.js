var assert = require('assert');

var moment = require('moment');
var mongoose = require('mongoose');

var db = require('../../models');

var OauthUserEvent = db.models.OauthUserEvent;

var requiredFields = [
    'user', 'client',
    'type',
    'created_at'
];

var validOauthUserEvent = function () {
    return new OauthUserEvent({
        user: mongoose.Types.ObjectId(),
        client: mongoose.Types.ObjectId(),
        type: 'login',
        created_at: new Date()
    });
};

describe('models.OauthUserEvent', function () {
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
        var oauthUserEvent = new OauthUserEvent();
        var now = moment(new Date()).format('YYYY-MM-DD');

        assert.strictEqual(moment(oauthUserEvent.at).format('YYYY-MM-DD'),
                           now);
    });

    it('validates that required fields are set', function (done) {
        var oauthUserEvent = new OauthUserEvent();

        requiredFields.forEach(function (field) {
            oauthUserEvent[field] = null;
        });

        oauthUserEvent.validate(function (err) {
            /* Make sure model throws an error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            requiredFields.forEach(function (field) {
                if (['created_at'].indexOf(field) !== -1) {
                    oauthUserEvent[field] = new Date();

                    return;
                }

                if (['type'].indexOf(field) !== -1) {
                    oauthUserEvent[field] = 'login';

                    return;
                }

                oauthUserEvent[field] = mongoose.Types.ObjectId();
            });

            oauthUserEvent.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
    
    it('validates event type', function (done) {
        var oauthUserEvent = validOauthUserEvent();

        oauthUserEvent.type = 'bar';

        oauthUserEvent.validate(function (err) {
            assert.strictEqual(err.errors.type.name, 'ValidatorError');

            /* Make sure model validation 
               pass when event type is valid */

            oauthUserEvent.type = 'login';

            oauthUserEvent.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
});