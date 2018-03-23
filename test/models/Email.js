var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var populateGrantedAuthorizations = require('../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var findOauthEntitiesID = require('../../models/middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('../../models/middlewares/pre/save/sendNotificationToClients');

var updateOauthUserStatus = require('../../models/middlewares/pre/save/updateOauthUserStatus');
var unsetHiddenProperties = require('../../models/middlewares/pre/save/unsetHiddenProperties');

var EmailSchema = require('../../models/Email');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var compareArray = require('../../testUtils/lib/compareArray');

var Email = db.models.Email;
var validEmail = function () {
    var email = new Email();

    email.address = mongoose.Types.ObjectId().toString() + '@evenid.com';
    email.user = mongoose.Types.ObjectId();

    return email;
};

var requiredFields = [
    'address', 'is_main_address', 
    'is_verified', 'user'
];

describe('models.Email', function () {
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
        var toObjectOpts = EmailSchema.get('toObject');
        var validHideOpt = [
            '_id', '__v',
            '_granted_authorizations',
            '_oauth_entities_id',
            'user'
        ];

        // Transform function is set for all 
        // models in the index function
        assert.ok(Type.is(toObjectOpts.transform, Function));
        
        assert.ok(compareArray(toObjectOpts.hide.split(' '),
                  validHideOpt));
    });

    it('applies default values', function () {
        var email = new Email();

        assert.strictEqual(email.is_main_address, false);
        assert.strictEqual(email.is_verified, false);

        // `toObject()`: Get a real JS array
        assert.deepEqual(email._granted_authorizations.toObject(), []); 
    });

    it('has pre validate middlewares registered', function () {
        var email = new Email();
        
        assert.strictEqual(email._pres.$__original_validate[0].toString(),
                           populateGrantedAuthorizations('emails').toString());
    });

    it('validates that required fields are set', function (done) {
        var email = new Email();

        // Default values apply 
        // to this properties if not set
        email.is_main_address = null;
        email.is_verified = null;

        email.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */

            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation pass 
               when all required fields are set */

            email.address = 'foo@evenid.com';
            email.is_main_address = true;
            email.is_verified = true;
            email.user = mongoose.Types.ObjectId().toString();

            email.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates email length', function (done) {
        var email = validEmail();

        email.address = 'foo@'
                      + new Array(config.EVENID_EMAILS
                                        .MAX_LENGTHS
                                        .ADDRESS).join('a')
                      + '.com',

        email.validate(function (err) {
            assert.strictEqual(err.errors.address.name, 'ValidatorError');

            /* Make sure model validation 
               pass when email is valid */

            email.address = 'foo@evenid.com';

            email.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates email', function (done) {
        var email = validEmail();

        email.address = 'foo';

        email.validate(function (err) {
            assert.strictEqual(err.errors.address.name, 'ValidatorError');

            /* Make sure model validation 
               pass when email is valid */

            email.address = 'foo@evenid.com';

            email.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that email is not already used', function (done) {
        var email = validEmail();
        var emailAddress = email.address;

        email.save(function (err) {
            var email = validEmail();

            if (err) {
                return done(err);
            }

            email.address = emailAddress;

            email.save(function (err) {
                assert.ok(isUniqueIndexError(err));

                done();
            });
        });
    });

    it('lowercases email', function () {
        var email = validEmail();

        email.address = 'fOo@EvenID.com';

        assert.strictEqual(email.address, 'foo@evenid.com');
    });

    it('has pre save middlewares registered', function () {
        var email = new Email();
        var expectedMiddlewares = [
            findOauthEntitiesID('emails').toString(),
            sendNotificationToClients('emails').toString(),
            updateOauthUserStatus('emails').toString(),
            unsetHiddenProperties('emails').toString()
        ];

        // May contains private Mongoose functions
        email._pres.$__original_save.forEach(function (middleware) {
            if (middleware.toString() === expectedMiddlewares[0].toString()) {
                expectedMiddlewares = expectedMiddlewares.slice(1);
            }
        });
        
        // Make sure all expected middlewares 
        // were registered in order
        assert.strictEqual(expectedMiddlewares.length, 0);
    });
});