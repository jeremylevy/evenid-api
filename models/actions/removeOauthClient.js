var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var removeOauthRedirectionURIs = require('./removeOauthRedirectionURIs');
var removeOauthHooks = require('./removeOauthHooks');
var removeOauthAuthorizations = require('./removeOauthAuthorizations');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (client, developerID, cb) {
    assert.ok(client && areValidObjectIDs([client._id]),
              'argument `client` must be a Mongoose document');

    assert.ok(areValidObjectIDs([developerID]),
              'argument `developerID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        removeClient: function (cb) {
            db.models.OauthClient.remove({
                _id: client._id
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        removeCorrespondingRedirectionURIs: ['removeClient', function (cb, results) {
            // Make sure redirection_uris is an array of IDs
            var rawClient = client.toObject({
                depopulate: true,
                minimize: false
            });

            if (rawClient.redirection_uris.length === 0) {
                return cb(null);
            }

            // `null`: Client ID
            // We don't need to pull redirect uris from client's redirect uris
            removeOauthRedirectionURIs(rawClient.redirection_uris, null, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        removeCorrespondingHooks: ['removeClient', function (cb, results) {
            // Make sure hooks is an array of IDs
            var rawClient = client.toObject({
                depopulate: true,
                minimize: false
            });

            if (rawClient.hooks.length === 0) {
                return cb(null);
            }

            // `null`: Client ID
            // We don't need to pull hooks from client's hooks
            removeOauthHooks(rawClient.hooks, null, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Pull client from user's owned clients
        updateOwnedClientsForDeveloper: ['removeClient', function (cb, results) {
            // At the time one developer by client
            db.models.User.findByIdAndUpdate(developerID, {
                $pull: { 
                    'developer.clients': client._id
                }
            }, function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        }],

        // Find authorizations issued to client
        findAuthorizations: ['removeClient', function (cb, results) {
            db.models.OauthAuthorization.find({
                'issued_to.client': client.id
            }, '_id issued_for', function (err, authorizations) {
                var authorizationIDs = [];
                var issuedFor = [];

                if (err) {
                    return cb(err);
                }

                authorizations.forEach(function (authorization) {
                    authorizationIDs.push(authorization._id);

                    // Users may have many authorizations for this client
                    if (issuedFor.indexOf(authorization.issued_for.toString()) === -1) {
                        issuedFor.push(authorization.issued_for.toString());
                    }
                });

                cb(null, {
                    authorizationIDs: authorizationIDs,
                    issuedFor: issuedFor
                });
            });
        }],

        // Remove all authorizations issued to client
        removeOauthAuthorizations: ['findAuthorizations', function (cb, results) {
            var authorizations = results.findAuthorizations;

            // Client has zero users
            if (authorizations.authorizationIDs.length === 0) {
                return cb(null);
            }

            removeOauthAuthorizations(authorizations.authorizationIDs, 
                                      client._id, 
                                      authorizations.issuedFor, 
                                      function (err) {
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