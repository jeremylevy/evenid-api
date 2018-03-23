var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../../models');

var populateGrantedAuthorizations = require('../../models/middlewares/pre/validate/populateGrantedAuthorizations');
var authorizeAccessToEntity = require('../../models/middlewares/pre/save/authorizeAccessToEntity');

var findOauthEntitiesID = require('../../models/middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('../../models/middlewares/pre/save/sendNotificationToClients');

var updateOauthUserStatus = require('../../models/middlewares/pre/save/updateOauthUserStatus');
var unsetHiddenProperties = require('../../models/middlewares/pre/save/unsetHiddenProperties');

var AddressSchema = require('../../models/Address');

var compareArray = require('../../testUtils/lib/compareArray');

var Address = db.models.Address;
var validAddress = function () {
    var address = new Address();

    requiredFields.forEach(function (field) {
        address[field] = mongoose.Types.ObjectId().toString();

        if (field === 'address_type') {
            address[field] = 'residential';
        }

        if (field === 'country') {
            address[field] = 'FR';
        }
    });

    return address;
};

var requiredFields = ['full_name', 'address_line_1', 
                      'city', 'postal_code', 
                      'country', 'address_type', 'user'];

describe('models.Address', function () {
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
        var toObjectOpts = AddressSchema.get('toObject');
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
        var address = new Address();

        /* `toObject()`: Get a real JS array */

        assert.deepEqual(address._granted_authorizations.toObject(), []); 
    });

    it('has pre validate middlewares registered', function () {
        var address = new Address();
        
        assert.strictEqual(address._pres.$__original_validate[0].toString(),
                           populateGrantedAuthorizations('addresses').toString());
    });

    it('validates that required fields are set', function (done) {
        var address = new Address();

        // Pre validate middleware 
        // `populateGrantedAuthorizations`
        // needs it
        address.user = mongoose.Types.ObjectId().toString();

        address.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                if (field === 'user') {
                    return;
                }

                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation 
               pass when all required fields are set */
            
            requiredFields.forEach(function (field) {
                address[field] = mongoose.Types.ObjectId().toString();

                if (field === 'country') {
                    address[field] = 'FR';
                }

                if (field === 'address_type') {
                    address[field] = 'residential';
                }
            });

            address.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates fields length', function (done) {
        var address = new Address({
            address_type: 'residential',
            // '+2': for first and last elements
            full_name: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.FULL_NAME + 2).join('a'),
            address_line_1: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_1 + 2).join('a'),
            address_line_2: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_2 + 2).join('a'),
            access_code: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.ACCESS_CODE + 2).join('a'),
            city: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.CITY + 2).join('a'),
            state: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.STATE + 2).join('a'),
            postal_code: new Array(config.EVENID_ADDRESSES.MAX_LENGTHS.POSTAL_CODE + 2).join('a'),
            country: 'US',
            user: mongoose.Types.ObjectId().toString()
        });

        address.validate(function (err) {
            assert.strictEqual(err.errors.full_name.name, 'ValidatorError');
            assert.strictEqual(err.errors.address_line_1.name, 'ValidatorError');
            assert.strictEqual(err.errors.address_line_2.name, 'ValidatorError');
            assert.strictEqual(err.errors.access_code.name, 'ValidatorError');
            assert.strictEqual(err.errors.city.name, 'ValidatorError');
            assert.strictEqual(err.errors.state.name, 'ValidatorError');
            assert.strictEqual(err.errors.postal_code.name, 'ValidatorError');

            /* Make sure model validation 
               pass when all fields are valid */

            address.full_name = address.address_line_1
                              = address.address_line_2
                              = address.access_code
                              = address.city
                              = address.state
                              = address.postal_code
                              = 'bar';

            address.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates country', function (done) {
        var address = validAddress();

        address.country = 'bar';

        address.validate(function (err) {
            assert.strictEqual(err.errors.country.name, 'ValidatorError');

            /* Make sure model validation pass 
               when country is valid */
               
            address.country = 'FR';

            address.validate(function (err) {
                assert.ok(!err);

                address.country = 'US';

                address.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    it('validates address type', function (done) {
        var address = validAddress();

        address.address_type = 'bar';

        address.validate(function (err) {
            assert.strictEqual(err.errors.address_type.name, 'ValidatorError');

            /* Make sure model validation pass 
               when address type is valid */

            address.address_type = 'commercial';

            address.validate(function (err) {
                assert.ok(!err);

                address.address_type = 'residential';

                address.validate(function (err) {
                    assert.ok(!err);

                    done();
                });
            });
        });
    });

    it('has pre save middlewares registered', function () {
        var address = new Address();
        var expectedMiddlewares = [
            authorizeAccessToEntity('addresses').toString(),
            findOauthEntitiesID('addresses').toString(),
            sendNotificationToClients('addresses').toString(),
            updateOauthUserStatus('addresses').toString(),
            unsetHiddenProperties('addresses').toString()
        ];

        // May contains private Mongoose functions
        address._pres.$__original_save.forEach(function (middleware) {
            if (middleware.toString() === expectedMiddlewares[0].toString()) {
                expectedMiddlewares = expectedMiddlewares.slice(1);
            }
        });
        
        // Make sure all expected middlewares 
        // were registered in order
        assert.strictEqual(expectedMiddlewares.length, 0);
    });

    it('has pre remove middlewares registered', function () {
        var address = new Address();
        var expectedMiddlewares = [
            populateGrantedAuthorizations('addresses').toString(),
            findOauthEntitiesID('addresses').toString(),
            sendNotificationToClients('addresses').toString(),
            updateOauthUserStatus('addresses').toString()
        ];

        // May contains private Mongoose functions
        address._pres.$__original_remove.forEach(function (middleware) {
            if (middleware.toString() === expectedMiddlewares[0].toString()) {
                expectedMiddlewares = expectedMiddlewares.slice(1);
            }
        });
        
        // Make sure all expected middlewares 
        // were registered in order
        assert.strictEqual(expectedMiddlewares.length, 0);
    });
});