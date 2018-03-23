var assert = require('assert');
var mongoose = require('mongoose');

var config = require('../../config');
var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var OauthHook = db.models.OauthHook;
var validOauthHook = function () {
    var oauthHook = new OauthHook();

    oauthHook.url = 'http://foo.com';
    oauthHook.event_type = 'USER_DID_REVOKE_ACCESS';
    oauthHook.client = mongoose.Types.ObjectId();

    return oauthHook;
};

var requiredFields = ['client', 'url', 'event_type'];

describe('models.OauthHook', function () {
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
        var oauthHook = new OauthHook();

        oauthHook.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */
            oauthHook.url = 'http://foo.com';
            oauthHook.event_type = 'USER_DID_REVOKE_ACCESS';
            oauthHook.client = mongoose.Types.ObjectId();

            oauthHook.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates URL', function (done) {
        var oauthHook = validOauthHook();

        oauthHook.url = 'foo';

        oauthHook.validate(function (err) {
            assert.strictEqual(err.errors.url.name, 'ValidatorError');

            /* Make sure model validation 
               pass when URL is valid */

            oauthHook.url = 'http://foo.com';

            oauthHook.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates URL length', function (done) {
        var oauthHook = validOauthHook();

        oauthHook.url = 'http://'
                      + new Array(config.EVENID_OAUTH_HOOKS
                                        .MAX_LENGTHS
                                        .URL + 2).join('a')
                      + '.com';

        oauthHook.validate(function (err) {
            assert.strictEqual(err.errors.url.name, 'ValidatorError');

            /* Make sure model validation 
               pass when URL is valid */

            oauthHook.url = 'http://foo.com';

            oauthHook.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates event type', function (done) {
        var oauthHook = validOauthHook();

        oauthHook.event_type = 'foo';

        oauthHook.validate(function (err) {
            assert.strictEqual(err.errors.event_type.name, 'ValidatorError');

            /* Make sure model validation  
               pass when event type is valid */

            oauthHook.event_type = 'USER_DID_REVOKE_ACCESS';

            oauthHook.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that `client.event_type` are unique', function (done) {
        var oauthHook = validOauthHook();
        var client = null;
        var eventType = null;

        client = oauthHook.client;
        eventType = oauthHook.event_type;

        oauthHook.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthHook = validOauthHook();

            // Reuse the same client and event type
            oauthHook.client = client;
            oauthHook.event_type = eventType;

            oauthHook.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});