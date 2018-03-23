var assert = require('assert');
var mongoose = require('mongoose');

var unsetHiddenProperties = require('../../../../../models/middlewares/pre/save/unsetHiddenProperties');

// We use phone numbers because 
// they have all hidden properties 
var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

describe('models.middlewares.pre.save.unsetHiddenProperties', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid entity name', function () {
        [null, undefined, {}, [], 'fooz', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                unsetHiddenProperties(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                unsetHiddenProperties('users').call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function () {
        [null, undefined, {}, [], '', 0.0].forEach(function (v) {
            assert.throws(function () {
                unsetHiddenProperties('users').call({
                    _id: mongoose.Types.ObjectId()
                }, v);
            }, assert.AssertionError);
        });
    });

    it('removes hidden properties', function (done) {
        // We use phone numbers because 
        // they have all hidden properties 
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber._granted_authorizations = ['foo'];
            phoneNumber._oauth_entities_id = ['bar'];
            phoneNumber._old_phone_type = 'unknown';

            unsetHiddenProperties('phone_numbers').call(phoneNumber, function () {
                assert.strictEqual(phoneNumber._granted_authorizations, undefined);
                assert.strictEqual(phoneNumber._oauth_entities_id, undefined);
                assert.strictEqual(phoneNumber._old_phone_type, undefined);

                done();
            });
        });
    });
});