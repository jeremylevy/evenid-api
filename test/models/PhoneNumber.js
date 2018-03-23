var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var db = require('../../models');

var populateGrantedAuthorizations = require('../../models/middlewares/pre/validate/populateGrantedAuthorizations');
var setPhoneType = require('../../models/middlewares/pre/validate/phoneNumber/setPhoneType');

var findOauthEntitiesID = require('../../models/middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('../../models/middlewares/pre/save/sendNotificationToClients');

var updateOauthUserStatus = require('../../models/middlewares/pre/save/updateOauthUserStatus');
var unsetHiddenProperties = require('../../models/middlewares/pre/save/unsetHiddenProperties');

var assertPhoneTypeMayBeUpdated = require('../../models/middlewares/pre/save/phoneNumber/assertPhoneTypeMayBeUpdated');

var PhoneNumberSchema = require('../../models/PhoneNumber');

var compareArray = require('../../testUtils/lib/compareArray');

var PhoneNumber = db.models.PhoneNumber;

var validPhoneNumber = function (phoneNumber) {
    phoneNumber = phoneNumber || new PhoneNumber();

    phoneNumber.number = '+33638490374';
    phoneNumber.country = 'FR';
    phoneNumber.user = mongoose.Types.ObjectId().toString();

    return phoneNumber;
};

var requiredFields = ['number', 'country', 'user'];

describe('models.PhoneNumber', function () {
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
        var toObjectOpts = PhoneNumberSchema.get('toObject');
        var validHideOpt = [
            '_id', '__v',
            '_granted_authorizations',
            '_oauth_entities_id',
            '_old_phone_type',
            'user'
        ];

        // Transform function is set for all 
        // models in the index function
        assert.ok(Type.is(toObjectOpts.transform, Function));
        
        assert.ok(compareArray(toObjectOpts.hide.split(' '),
                  validHideOpt));
        
        assert.strictEqual(toObjectOpts.virtuals, true);
        assert.strictEqual(toObjectOpts.getters, true);
    });

    it('applies default values', function () {
        var phoneNumber = new PhoneNumber();

        assert.strictEqual(phoneNumber.phone_type, 'unknown');

        // `toObject()`: Get a real JS array
        assert.deepEqual(phoneNumber._granted_authorizations.toObject(), []); 
    });

    it('uses custom getters and setters', function () {
        var phoneNumber = validPhoneNumber();

        // Returns number in user country format
        assert.strictEqual(phoneNumber.number, '06 38 49 03 74');
    });

    it('has virtuals', function () {
        var phoneNumber = validPhoneNumber();

        phoneNumber.number = '0638490374';

        // Returns number in international format (E164)
        assert.strictEqual(phoneNumber.international_number, '+33638490374');
    });

    it('has pre validate middlewares registered', function () {
        var phoneNumber = new PhoneNumber();

        assert.strictEqual(phoneNumber._pres.$__original_validate[0].toString(),
                           setPhoneType.toString());
        
        assert.strictEqual(phoneNumber._pres.$__original_validate[1].toString(),
                           populateGrantedAuthorizations('phone_numbers').toString());
    });

    it('validates that required fields are set', function (done) {
        var phoneNumber = new PhoneNumber();

        phoneNumber.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */

            validPhoneNumber(phoneNumber).validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates phone number for region', function (done) {
        var phoneNumber = validPhoneNumber();

        phoneNumber.number = '6763-983-374';
        phoneNumber.country = 'FR';
        phoneNumber.phone_type = 'unknown';

        phoneNumber.validate(function (err) {
            assert.strictEqual(err.errors.number.name, 'ValidatorError');

            /* Make sure model validation pass 
               when number is valid for region */

            phoneNumber.number = '+33638490374';

            phoneNumber.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that phone type match phone number', function (done) {
        var phoneNumber = validPhoneNumber();

        phoneNumber.number = '+33638490374';
        phoneNumber.country = 'FR';
        // We use landline for a mobile number
        phoneNumber.phone_type = 'landline';

        phoneNumber.validate(function (err) {
            assert.strictEqual(err.errors.number.name, 'ValidatorError');

            /* Make sure model validation pass 
               when number is valid for region */

            phoneNumber.phone_type = 'mobile';

            phoneNumber.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates phone type', function (done) {
        var phoneNumber = validPhoneNumber();

        phoneNumber.number = '+33638490374';
        phoneNumber.country = 'FR';
        phoneNumber.phone_type = 'foo';

        phoneNumber.validate(function (err) {
            assert.strictEqual(err.errors.phone_type.name, 'ValidatorError');

            /* Make sure model validation pass 
               when phone type is valid */

            phoneNumber.phone_type = 'mobile';

            phoneNumber.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('has pre save middlewares registered', function () {
        var phoneNumber = new PhoneNumber();
        var expectedMiddlewares = [
            assertPhoneTypeMayBeUpdated.toString(),
            findOauthEntitiesID('phone_numbers').toString(),
            sendNotificationToClients('phone_numbers').toString(),
            updateOauthUserStatus('phone_numbers').toString(),
            unsetHiddenProperties('phone_numbers').toString()
        ];

        // May contains private Mongoose functions
        phoneNumber._pres.$__original_save.forEach(function (middleware) {
            if (middleware.toString() === expectedMiddlewares[0].toString()) {
                expectedMiddlewares = expectedMiddlewares.slice(1);
            }
        });
        
        // Make sure all expected middlewares 
        // were registered in order
        assert.strictEqual(expectedMiddlewares.length, 0);
    });
});