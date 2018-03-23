var assert = require('assert');

var moment = require('moment');

var db = require('../../models');

var Event = db.models.Event;

var requiredFields = ['type', 'created_at'];

describe('models.Event', function () {
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
        var event = new Event();
        var now = moment(new Date()).format('YYYY-MM-DD');

        assert.strictEqual(moment(event.created_at).format('YYYY-MM-DD'), now);
    });

    it('validates that required fields are set', function (done) {
        var event = new Event();

        event.type = null;
        event.created_at = null;

        event.validate(function (err) {
            // Make sure models throw error when required fields
            // are not set
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            // Make sure model validation pass when all required
            // fields are set
            event.type = 'user_created';
            event.created_at = new Date();

            event.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates IP address', function (done) {
        var event = new Event();

        event.ip_address = 'foo';
        event.type = 'user_created';
        event.created_at = new Date();

        event.validate(function (err) {
            assert.strictEqual(err.errors.ip_address.name, 'ValidatorError');

            /* Make sure  model validation pass 
               when IP address is valid */

            event.ip_address = '127.0.0.1';

            event.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates event type', function (done) {
        var event = new Event();

        event.ip_address = '127.0.0.1';
        event.type = 'foo';
        event.created_at = new Date();

        event.validate(function (err) {
            assert.strictEqual(err.errors.type.name, 'ValidatorError');

            /* Make sure model validation pass 
               when event type is valid */

            event.type = 'user_created';

            event.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
});