var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../../../config');

var grantedAuthorizations = require('../../../../models/properties/schemas/grantedAuthorizations');

var Schema = mongoose.Schema;

var isValidGrantedAuthorizationsObj = function (entity) {
    var grantedAuthorizationsSchema = grantedAuthorizations(entity);

    var _grantedAuthorizations = grantedAuthorizationsSchema._granted_authorizations;
    var user = grantedAuthorizationsSchema.user;

    assert.strictEqual(_grantedAuthorizations.type, Array);
    assert.deepEqual(_grantedAuthorizations.default, []);

    if (entity !== 'users') {
        assert.strictEqual(user.type, Schema.Types.ObjectId);
        assert.strictEqual(user.ref, 'User');
        assert.strictEqual(user.required, true);
    }
};

describe('models.properties.schemas.grantedAuthorizations', function () {
    it('throws an exception when passing invalid entity', function () {
        [null, undefined, {}, [], 'foo', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                grantedAuthorizations(v);
            }, assert.AssertionError);
        });
    });

    it('returns valid object when passing valid entity', function () {
        isValidGrantedAuthorizationsObj('users');
        isValidGrantedAuthorizationsObj('emails');
        isValidGrantedAuthorizationsObj('phone_numbers');
        isValidGrantedAuthorizationsObj('addresses');
    });
});