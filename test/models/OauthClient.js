var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var OauthClientSchema = require('../../models/OauthClient');

var createHash = require('../../libs/createHash');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var compareArray = require('../../testUtils/lib/compareArray');

var OauthClient = db.models.OauthClient;
var validClient = function (oauthClient) {
    requiredFields.forEach(function (field) {
        var value = 'foo';

        if (field === 'client_id') {
            value = mongoose.Types.ObjectId();
        }

        if (['authorize_test_accounts'].indexOf(field) !== -1) {
            
            value = true;
        }

        if (field === 'logo') {
            value = logoURL;
        }

        if (['website'].indexOf(field) !== -1) {
            value = 'https://foo.com';
        }
        
        oauthClient[field] = value;
    });

    return oauthClient;
};

var logoHash = createHash('sha1', mongoose.Types.ObjectId().toString());
var logoURL = config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS + '/clients/logos/' + logoHash;

var requiredFields = ['client_id', 'client_secret', 
                      'name', 'logo', 'description', 
                      'website', 'authorize_test_accounts'];

describe('models.OauthClient', function () {
    // Connect to database
    before(function (done) {
        require('../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('has valid `toObject` options', function () {
        var toObjectOpts = OauthClientSchema.get('toObject');
        var validHideOpt = ['_id', '__v'];

        // Transform function is set for all 
        // models in the index function
        assert.ok(Type.is(toObjectOpts.transform, Function));
        
        assert.ok(compareArray(toObjectOpts.hide.split(' '),
                  validHideOpt));
        
        assert.strictEqual(toObjectOpts.getters, true);
    });

    it('applies default values', function () {
        var oauthClient = new OauthClient();

        assert.strictEqual(oauthClient.authorize_test_accounts, true);
    });

    it('uses custom getters and setters for logo property', function () {
        var oauthClient = new OauthClient();

        oauthClient = validClient(oauthClient);
        oauthClient.logo = logoURL;

        // Check that logo setter has set
        // logo ID in `logo` field
        assert.strictEqual(oauthClient.toObject({
            getters: false
        }).logo, logoHash);

        // Check that logo getter
        // reconstruct the full URL
        assert.strictEqual(oauthClient.logo, 
                           config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS + '/clients/logos/' + logoHash);
    });

    it('validates that required fields are set', function (done) {
        var oauthClient = new OauthClient();

        requiredFields.forEach(function (field) {
            oauthClient[field] = null;
        });

        oauthClient.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation pass 
               when all required fields are set */

            oauthClient = validClient(oauthClient);

            oauthClient.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates fields length', function (done) {
        var oauthClient = validClient(new OauthClient());
        var invalidFields = {
            // '+2': for first and last elements
            name: new Array(config.EVENID_OAUTH_CLIENTS
                                  .MAX_LENGTHS
                                  .NAME + 2).join('a'),

            description: new Array(config.EVENID_OAUTH_CLIENTS
                                         .MAX_LENGTHS
                                         .DESCRIPTION + 2).join('a'),

            website: 'http://' + new Array(config.EVENID_OAUTH_CLIENTS
                                                 .MAX_LENGTHS
                                                 .WEBSITE + 2).join('a') + '.com',

            facebook_username: new Array(config.EVENID_OAUTH_CLIENTS
                                               .MAX_LENGTHS
                                               .FACEBOOK_USERNAME + 2).join('a'),

            twitter_username: new Array(config.EVENID_OAUTH_CLIENTS
                                              .MAX_LENGTHS
                                              .TWITTER_USERNAME + 2).join('a'),

            instagram_username: new Array(config.EVENID_OAUTH_CLIENTS
                                                .MAX_LENGTHS
                                                .INSTAGRAM_USERNAME + 2).join('a')
        };

        Object.keys(invalidFields).forEach(function (invalidField) {
            oauthClient[invalidField] = invalidFields[invalidField];
        });

        oauthClient.validate(function (err) {
            assert.strictEqual(err.errors.name.name, 'ValidatorError');
            assert.strictEqual(err.errors.description.name, 'ValidatorError');
            assert.strictEqual(err.errors.website.name, 'ValidatorError');
            assert.strictEqual(err.errors.facebook_username.name, 'ValidatorError');
            assert.strictEqual(err.errors.twitter_username.name, 'ValidatorError');
            assert.strictEqual(err.errors.instagram_username.name, 'ValidatorError');

            /* Make sure model validation pass when all fields
               are valid */

            oauthClient.name = oauthClient.description
                             = oauthClient.facebook_username
                             = oauthClient.twitter_username
                             = oauthClient.instagram_username
                             = 'foobar';

            oauthClient.website = 'http://bar.com';

            oauthClient.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates logo', function (done) {
        var oauthClient = new OauthClient();

        oauthClient = validClient(oauthClient);
        oauthClient.logo = 'foo';

        oauthClient.validate(function (err) {
            assert.strictEqual(err.errors.logo.name, 'ValidatorError');

            /* Make sure model validation 
               pass when logo is valid */

            oauthClient.logo = logoURL;

            oauthClient.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates website', function (done) {
        var oauthClient = new OauthClient();

        oauthClient = validClient(oauthClient);
        oauthClient.website = 'foo';

        oauthClient.validate(function (err) {
            assert.strictEqual(err.errors.website.name, 'ValidatorError');

            /* Make sure model validation 
               pass when website is valid */

            oauthClient.website = 'https://foo.com';

            oauthClient.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that `client_id` is unique', function (done) {
        var oauthClient = new OauthClient();
        var clientID = null;

        oauthClient = validClient(oauthClient);
        clientID = oauthClient.client_id;

        oauthClient.save(function (err) {
            if (err) {
                return done(err);
            }

            oauthClient = validClient(new OauthClient());

            // Reuse the same client ID
            oauthClient.client_id = clientID;

            oauthClient.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });
});