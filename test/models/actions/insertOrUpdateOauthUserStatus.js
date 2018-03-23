var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../config');

var db = require('../../../models');

var insertOrUpdateOauthUserStatus = require('../../../models/actions/insertOrUpdateOauthUserStatus');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');

var findOauthUserStatus = require('../../../testUtils/db/findOauthUserStatus');
var updateOauthUserStatus = require('../../../testUtils/db/updateOauthUserStatus');

describe('models.actions.insertOrUpdateOauthUserStatus', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing '
       + 'non-boolean value for `userUseTestAccount`', function () {
        
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOrUpdateOauthUserStatus(v, 
                                              new db.models.OauthAuthorization(), 
                                              mongoose.Types.ObjectId(),
                                              mongoose.Types.ObjectId(),
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid oauth authorization', function () {
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOrUpdateOauthUserStatus(false, 
                                              v, 
                                              mongoose.Types.ObjectId(),
                                              mongoose.Types.ObjectId(),
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOrUpdateOauthUserStatus(false, 
                                              new db.models.OauthAuthorization(), 
                                              v,
                                              mongoose.Types.ObjectId(),
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as client ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOrUpdateOauthUserStatus(false, 
                                              new db.models.OauthAuthorization(), 
                                              mongoose.Types.ObjectId(),
                                              v,
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as client ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOrUpdateOauthUserStatus(false, 
                                              new db.models.OauthAuthorization(), 
                                              mongoose.Types.ObjectId(),
                                              mongoose.Types.ObjectId(),
                                              v);
            }, assert.AssertionError);
        });
    });

    it('creates user status if it doesn\'t exist', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();
        var useTestAccount = false;
        var oauthAuthorization = new db.models.OauthAuthorization();

        insertOrUpdateOauthUserStatus(useTestAccount, oauthAuthorization, 
                                      userID, clientID,
                                      function (err) {
            
            if (err) {
                return done(err);
            }

            // Make sure status was inserted
            findOauthUserStatus(clientID, userID, function (err, oauthUserStatus) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserStatus.client.toString(), clientID.toString());
                assert.strictEqual(oauthUserStatus.user.toString(), userID.toString());
                assert.strictEqual(oauthUserStatus.status, 'new_user');
                assert.strictEqual(oauthUserStatus.use_test_account, useTestAccount);

                done();
            });
        });
    });

    it('updates user status when user registers for real after testing', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();
        var oauthAuthorization = new db.models.OauthAuthorization();

        oauthAuthorization.scope = ['emails', 'first_name', 'addresses'];

        async.auto({
            createOauthUserStatus: function (cb) {
                var useTestAccount = true;

                insertOrUpdateOauthUserStatus(useTestAccount, oauthAuthorization, 
                                              userID, clientID,
                                              function (err) {
            
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            },

            updateOauthUserStatus: ['createOauthUserStatus', function (cb) {
                var useTestAccount = false;

                // User status can't pass from `new_user` to `existing_user_test` 
                // without calling the GET /users API method between.
                // Fake it by updating the value directly in DB.
                updateOauthUserStatus({
                    user: userID,
                    client: clientID
                }, {
                    status: 'existing_user'
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    insertOrUpdateOauthUserStatus(useTestAccount, oauthAuthorization, 
                                                  userID, clientID,
                                                  function (err) {
                
                        if (err) {
                            return cb(err);
                        }

                        cb();
                    });
                });
            }],

            assertOauthUserStatusWasUpdated: ['updateOauthUserStatus', function (cb) {
                findOauthUserStatus(clientID, userID, function (err, oauthUserStatus) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserStatus.status, 'existing_user_after_test');
                    assert.strictEqual(oauthUserStatus.use_test_account, false);

                    // `toObject()` to get real JS array
                    assert.ok(compareArray(oauthUserStatus.updated_fields, 
                                           config.EVENID_OAUTH
                                                 .VALID_USER_SCOPE));

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        })
    });
});