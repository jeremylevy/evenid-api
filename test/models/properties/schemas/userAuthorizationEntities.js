var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../../../config');

var userAuthorizationEntities = require('../../../../models/properties/schemas/userAuthorizationEntities');

var Schema = mongoose.Schema;

var isValidUserAuthorizationEntitiesObj = function (entity) {
    var userAuthorizationEntitiesSchema = userAuthorizationEntities(entity);

    var email = null;
    var phoneNumber = null;
    var address = userAuthorizationEntitiesSchema.addresses[0];

    if (entity === 'userAuthorization') {
        email = userAuthorizationEntitiesSchema.emails[0];
        phoneNumber = userAuthorizationEntitiesSchema.phone_numbers[0];

        assert.strictEqual(email.type, Schema.Types.ObjectId);
        assert.strictEqual(email.ref, 'Email');

        assert.strictEqual(phoneNumber.type, Schema.Types.ObjectId);
        assert.strictEqual(phoneNumber.ref, 'PhoneNumber');

        assert.strictEqual(address.type, Schema.Types.ObjectId);
        assert.strictEqual(address.ref, 'Address');
    }

    if (entity === 'oauthAuthorization') {
        assert.strictEqual(address.address.type, Schema.Types.ObjectId);
        assert.strictEqual(address.address.ref, 'Address');

        assert.strictEqual(address['for'].type, Array);
        
        // One validator: valid `for` field value
        assert.strictEqual(address['for'].validate.length, 1);
    }
};

describe('models.properties.schemas.userAuthorizationEntities', function () {
    it('throws an exception when passing invalid entity', function () {
        [null, undefined, {}, [], 'foo', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                userAuthorizationEntities(v);
            }, assert.AssertionError);
        });
    });

    it('returns valid object when passing valid entity', function () {
        isValidUserAuthorizationEntitiesObj('oauthAuthorization');
        
        isValidUserAuthorizationEntitiesObj('userAuthorization');
    });
});