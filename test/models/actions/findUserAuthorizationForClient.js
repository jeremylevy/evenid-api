var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var findUserAuthorizationForClient = require('../../../models/actions/findUserAuthorizationForClient');

var compareArray = require('../../../testUtils/lib/compareArray');

var createUserAuthorization = require('../../../testUtils/db/createUserAuthorization');

describe('models.actions.findUserAuthorizationForClient', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizationForClient(v, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizationForClient(mongoose.Types.ObjectId(), v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizationForClient(mongoose.Types.ObjectId(), mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('returns valid object with empty values when authorization doesn\'t exist', function (done) {
        findUserAuthorizationForClient(mongoose.Types.ObjectId(), 
                                       mongoose.Types.ObjectId(), 
                                       function (err, userAuthorization) {
            
            if (err) {
                return done(err);
            }
            
            /* `toObject()` to get a real array */
            assert.deepEqual(userAuthorization.scope.toObject(), []);
            assert.deepEqual(userAuthorization.entities.emails.toObject(), []);
            assert.deepEqual(userAuthorization.entities.phone_numbers.toObject(), []);
            assert.deepEqual(userAuthorization.entities.addresses.toObject(), []);

            done();
        });
    });

    it('returns user authorization when client and user exist', function (done) {
        
        createUserAuthorization(function (err, userAuthorizationRef) {
            if (err) {
                return done(err);
            }

            findUserAuthorizationForClient(userAuthorizationRef.user, 
                                           userAuthorizationRef.client, 
                                           function (err, userAuthorization) {
                
                if (err) {
                    return done(err);
                }

                assert.strictEqual(userAuthorization.client.toString(), 
                                   userAuthorizationRef.client.toString());

                assert.strictEqual(userAuthorization.user.toString(), 
                                   userAuthorizationRef.user.toString());

                /* `toObject()`: Returns a native js Array. */
                
                assert.ok(compareArray(userAuthorization.scope.toObject(), 
                                       userAuthorizationRef.scope.toObject()));

                assert.ok(compareArray(userAuthorization.entities.emails.toObject(), 
                                 userAuthorizationRef.entities.emails.toObject()));

                assert.ok(compareArray(userAuthorization.entities.phone_numbers.toObject(),
                                       userAuthorizationRef.entities.phone_numbers.toObject()));

                assert.ok(compareArray(userAuthorization.entities.addresses.toObject(), 
                                       userAuthorizationRef.entities.addresses.toObject()));

                done();
            });
        });
    });
});