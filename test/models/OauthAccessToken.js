var assert = require('assert');

var moment = require('moment');
var mongoose = require('mongoose');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var OauthAccessToken = db.models.OauthAccessToken;
var validOauthAccessToken = function () {
    var oauthAccessToken = new OauthAccessToken();

    requiredFields.forEach(function (field) {
        var value = mongoose.Types.ObjectId().toString();

        if (field === 'expires_at') {
            value = new Date();
        }

        if (field === 'authorization') {
            value = mongoose.Types.ObjectId();
        }

        oauthAccessToken[field] = value;
    });

    return oauthAccessToken;
};

var requiredFields = ['token', 'expires_at', 'authorization', 'refresh_token'];

describe('models.OauthAccessToken', function () {
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
        var oauthAccessToken = new OauthAccessToken();
        var now = moment(new Date()).format('YYYY-MM-DD');

        assert.strictEqual(moment(oauthAccessToken.issued_at).format('YYYY-MM-DD'),
                           now);
    });

    it('validates that required fields are set', function (done) {
        var oauthAccessToken = new OauthAccessToken();

        requiredFields.forEach(function (field) {
            oauthAccessToken[field] = null;
        });

        oauthAccessToken.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
               
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            oauthAccessToken = validOauthAccessToken();

            oauthAccessToken.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });
    
    it('validates that access token is unique', function (done) {
        var oauthAccessToken = validOauthAccessToken();
        var accessToken = oauthAccessToken.token;

        oauthAccessToken.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthAccessToken = validOauthAccessToken();
            oauthAccessToken.token = accessToken;

            oauthAccessToken.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });

    it('validates that refresh token is unique', function (done) {
        var oauthAccessToken = validOauthAccessToken();
        var refreshToken = oauthAccessToken.refresh_token;

        oauthAccessToken.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthAccessToken = validOauthAccessToken();
            oauthAccessToken.refresh_token = refreshToken;

            oauthAccessToken.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});