var Type = require('type-of-is');
var async = require('async');

var db = require('../../../../models');

// An user which was registered on EvenID, 
// has used a test account as unlogged user.
// Try to attach it to user to send the same IDs for client.
module.exports = function (req, res, next) {
    var client = res.locals.client;

    var oauthAuthorization = res.locals.oauthAuthorization;
    
    var user = res.locals.user;
    var userAuthorizationForClient = res.locals.userAuthorizationForClient;

    var useTestAccount = res.locals.useTestAccount;
    // Test account is optional so don't check for its existence
    var testAccount = res.locals.testAccount;

    var userNotTestUserRegisterAfterTest = res.locals.registrationAfterTest;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `boundTestAccountToUser` '
                        + 'middleware');
    }

    if (!oauthAuthorization) {
        throw new Error('`oauthAuthorization` must be set as response locals '
                        + 'property before calling `boundTestAccountToUser` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `boundTestAccountToUser` '
                        + 'middleware');
    }

    if (!useTestAccount && !userAuthorizationForClient) {
        throw new Error('`userAuthorizationForClient` must be set as response locals '
                        + 'property before calling `boundTestAccountToUser` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `boundTestAccountToUser` '
                        + 'middleware');
    }

    if (!Type.is(userNotTestUserRegisterAfterTest, Boolean)) {
        throw new Error('`registrationAfterTest` must be set as response locals '
                        + 'property before calling `boundTestAccountToUser` '
                        + 'middleware');
    }

    // User still uses test account
    if (useTestAccount
        // User is already registered on client
        || userAuthorizationForClient.scope.length
        // User has not used a test account
        || !testAccount
        // User was not registered on EvenID
        // prior to use test account
        || testAccount.id === user.id
        // User has used test account 
        // as unlogged and as logged user.
        // We can't bound test account to user 
        // given that we will have the same document 
        // twice and user status unique index error.
        || userNotTestUserRegisterAfterTest) {
        
        return next();
    }
    
    async.auto({
        // When entities ID will be inserted in next middlewares
        // fake IDs will be conserved and real IDs replaced with 
        // authorized entities. Before that, we need to replace the
        // `user` property of each ID to be able to find it.
        attachTestAccountEntitiesIDToUser: function (cb) {
            db.models.OauthEntityID.update({
                client: client.id,
                user: testAccount.id,
                use_test_account: true
            }, {
                user: user.id
            }, {
                // Multiple entities may be updated
                multi: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // The sole real ID that we need to replace 
        // if for the users entity.
        // We need to go from test account ID 
        // to just registered user id
        matchTestAccountUserID: ['attachTestAccountEntitiesIDToUser', function (cb) {
            db.models.OauthEntityID.update({
                client: client.id,
                user: user.id,
                entities: ['users'],
                use_test_account: true
            }, {
                real_id: user.id
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Allow the passage to `existing_user_after_test` status
        attachTestAccountUserStatusToUser: function (cb) {
            db.models.OauthUserStatus.update({
                client: client.id,
                user: testAccount.id,
                use_test_account: true
            }, {
                user: user.id
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // Not sure what is best here...
        // Delete the issued authorizations ?
        // Update it ?
        attachTestAccountAuthorizationsToUser: function (cb) {
            db.models.OauthAuthorization.update({
                issued_for: testAccount.id
            }, {
                issued_for: user.id,
                // Remember that the client can update redirection uri scope
                // after user has used test account 
                // but before it register for real
                // so make sure authorizations granted to 
                // test account were limited to the scope 
                // that user has granted during registration
                scope: oauthAuthorization.scope,
                scope_flags: oauthAuthorization.scope_flags,
                // Also we may want to match addresses `for` attributes
                user: oauthAuthorization.user
            }, {
                // Multiple authorizations may be updated
                multi: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }
    }, function (err, results) {
        if (err) {
            return next(err);
        }

        next();
    });
};