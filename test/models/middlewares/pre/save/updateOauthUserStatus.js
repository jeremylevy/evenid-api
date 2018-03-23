var assert = require('assert');
var mongoose = require('mongoose');

var updateOauthUserStatus = require('../../../../../models/middlewares/pre/save/updateOauthUserStatus');

var createAddress = require('../../../../../testUtils/db/createAddress');

describe('models.middlewares.pre.save.updateOauthUserStatus', function () {
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
                updateOauthUserStatus(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                updateOauthUserStatus('users').call(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function as next', function () {
        [null, undefined, {}, [], '', 0.0].forEach(function (v) {
            assert.throws(function () {
                updateOauthUserStatus('users').call({
                    _id: mongoose.Types.ObjectId()
                }, v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-user '
       + 'entity without user property', function (done) {
        
        createAddress(function (err, address) {
            if (err) {
                return done(err);
            }

            address.user = undefined;

            assert.throws(function () {
                updateOauthUserStatus('addresses').call(address, function () {

                });
            }, assert.AssertionError);

            done();
        });
    });

    it('throws an exception when passing entity '
       + 'without `_granted_authorizations` property', function (done) {
        
        createAddress(function (err, address) {
            if (err) {
                return done(err);
            }

            address.user = mongoose.Types.ObjectId();

            assert.throws(function () {
                updateOauthUserStatus('addresses').call(address, function () {

                });
            }, assert.AssertionError);

            done();
        });
    });
});