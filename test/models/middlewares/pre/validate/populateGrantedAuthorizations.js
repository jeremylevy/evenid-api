var assert = require('assert');

var populateGrantedAuthorizations = require('../../../../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var createUser = require('../../../../../testUtils/db/createUser');
var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');

describe('models.middlewares.pre.validate.populateGrantedAuthorizations', function () {
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
        [null, undefined, {}, [], 'foo', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                populateGrantedAuthorizations(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid event name', function () {
        // Needs non-false value
        [{}, [], 'foo', function () {}].forEach(function (v) {
            assert.throws(function () {
                populateGrantedAuthorizations.call({
                    eventName: v
                }, 'users');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                populateGrantedAuthorizations('users').call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    populateGrantedAuthorizations('users').call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('throws an exception when passing non-user '
       + 'entity without user property', function (done) {
        
        createPhoneNumber(function (err, phoneNumber) {
            if (err) {
                return done(err);
            }

            phoneNumber.user = undefined;

            assert.throws(function () {
                populateGrantedAuthorizations('phone_numbers').call(phoneNumber, function () {

                });
            }, assert.AssertionError);

            done();
        });
    });
});