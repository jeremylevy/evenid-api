var assert = require('assert');
var mongoose = require('mongoose');

var findOauthUserStatus = require('../../../models/actions/findOauthUserStatus');

var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');

describe('models.actions.findOauthUserStatus', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOauthUserStatus(mongoose.Types.ObjectId(), 
                                    v, 
                                    function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOauthUserStatus(v, 
                                    mongoose.Types.ObjectId(), 
                                    function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                findOauthUserStatus(mongoose.Types.ObjectId(), 
                                    mongoose.Types.ObjectId(), 
                                    v);
            }, assert.AssertionError);
        });
    });

    it('returns `null` when user status doesn\'t exist', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        findOauthUserStatus(clientID, userID, function (err, oauthUserStatus) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(oauthUserStatus, null);

            done();
        });
    });

    it('returns oauth user status when it was previously created', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();
        var status = 'existing_user';
        var useTestAccount = false;

        createOauthUserStatus(clientID, userID, 
                              status, useTestAccount, function (err, oauthUserStatus) {
            
            if (err) {
                return done(err);
            }

            findOauthUserStatus(clientID, userID, function (err, oauthUserStatus) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserStatus.client.toString(), clientID.toString());
                assert.strictEqual(oauthUserStatus.user.toString(), userID.toString());
                assert.strictEqual(oauthUserStatus.status, status);
                assert.strictEqual(oauthUserStatus.use_test_account, useTestAccount);

                done();
            });
        });
    });
});