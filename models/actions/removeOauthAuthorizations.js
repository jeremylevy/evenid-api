var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// `clientID` and `usersID` are set when 
// user revock access to client
// or when client was removed
module.exports = function (authorizationIDs, clientID, usersID, cb) {
    // `areValidObjectIDs` check for the `addressIDs` type
    // and its emptiness
    assert.ok(areValidObjectIDs(authorizationIDs),
              'argument `authorizationIDs` must be an array of ObjectIDs');

    assert.ok(!clientID || areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(!usersID || areValidObjectIDs(usersID),
              'argument `usersID` must be an array of ObjectIDs');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    if (!usersID && clientID
        || usersID && !clientID) {

        throw new Error('You must set client ID and users ID.');
    }

    async.auto({
        removeAuthorizations: function (cb) {
            db.models.OauthAuthorization.remove({
                _id: {
                    $in: authorizationIDs
                }
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        removeCorrespondingAccessTokens: ['removeAuthorizations', function (cb, results) {
            db.models.OauthAccessToken.remove({
                authorization: {
                    $in: authorizationIDs
                }
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Pull client from users authorized clients
        updateAuthorizedClientsForUser: ['removeAuthorizations', function (cb, results) {
            if (!usersID || !clientID) {
                return cb(null);
            }

            db.models.User.update({
                _id: {
                    $in: usersID
                }
            }, {
                $pull: { 
                    authorized_clients: clientID
                }
            }, {
                // We can update many users
                multi: usersID.length > 1
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        removeUserAuthorizations: ['updateAuthorizedClientsForUser', function (cb, results) {
            if (!usersID || !clientID) {
                return cb(null);
            }

            db.models.UserAuthorization.remove({
                user: {
                    $in: usersID
                },
                
                client: clientID
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        removeOauthUserStatus: ['updateAuthorizedClientsForUser', function (cb, results) {
            if (!usersID || !clientID) {
                return cb(null);
            }

            db.models.OauthUserStatus.remove({
                user: {
                    $in: usersID
                },
                
                client: clientID
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        removeTestAccounts: ['updateAuthorizedClientsForUser', function (cb, results) {
            if (!usersID || !clientID) {
                return cb(null);
            }

            db.models.TestUser.remove({
                user: {
                    $in: usersID
                },
                
                client: clientID
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        removeClientSpecificID: ['updateAuthorizedClientsForUser', function (cb, results) {
            if (!usersID || !clientID) {
                return cb(null);
            }

            db.models.OauthEntityID.remove({
                user: {
                    $in: usersID
                },
                
                client: clientID
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};