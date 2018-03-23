var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var findOauthUserStatus = require('./findOauthUserStatus');
var updateOauthUserStatus = require('./updateOauthUserStatus');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (userUseTestAccount, oauthAuthorization, userID, clientID, cb) {
    assert.ok(Type.is(userUseTestAccount, Boolean),
              'argument `userUseTestAccount` must be a boolean');

    assert.ok(oauthAuthorization instanceof db.models.OauthAuthorization,
              'argument `oauthAuthorization` must be '
              + 'an instance of Oauth authorization');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        findOldUserStatus: function (cb) {
            findOauthUserStatus(clientID, userID, function (err, userStatus) {
                if (err) {
                    return cb(err);
                }

                cb(null, userStatus);
            });
        },

        insertUserStatus: ['findOldUserStatus', function (cb, results) {
            var oldUserStatus = results.findOldUserStatus;
            var newStatus = 'new_user';
            var update = {};

            if (!oldUserStatus) {
                db.models.OauthUserStatus.create({
                    client: clientID,
                    user: userID,
                    status: 'new_user',
                    use_test_account: userUseTestAccount
                }, function (err, userStatus) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userStatus);
                });

                return;
            }

            /* Status will be reseted to `existing_user`
               when client calls the GET /user/{user_id} method
               for this user */
                
            if (oldUserStatus.use_test_account
                && !userUseTestAccount) {
                
                update.status = 'existing_user_after_test';
                update.use_test_account = false;

                // All user fields needs to be updated 
                // when user logs for the first time after test.
                // Updated fields will be filtered in get user method
                // depending on used oauth authorization scope.
                update.updated_fields = config.EVENID_OAUTH
                                              .VALID_USER_SCOPE;
            }

            // We don't need to update user status
            if (!Object.keys(update).length) {
                return cb(null, oldUserStatus);
            }

            updateOauthUserStatus([clientID], 
                                  userID, 
                                  update,
                                  function (err) {
                    
                if (err) {
                    return cb(err);
                }

                cb(null, oldUserStatus);
            });
        }]
    }, function (err, results) {
        var userStatus = results && results.insertUserStatus;

        if (err) {
            return cb(err);
        }

        cb(null, userStatus);
    });
};