var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (redirectURIIDs, clientID, cb) {
    // `areValidObjectIDs` check for the 
    // `redirectURIIDs` type and its emptiness
    assert.ok(areValidObjectIDs(redirectURIIDs),
              'argument `redirectURIIDs` must be an array of ObjectIDs');

    assert.ok(!clientID || areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    async.auto({
        removeRedirectURIs: function (cb) {
            db.models.OauthRedirectionURI.remove({
                _id: {
                    $in: redirectURIIDs
                }
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        },

        // Pull redirect URI from 
        // client's redirect URIs
        updateRedirectURIsForClient: ['removeRedirectURIs', function (cb, results) {
            // Called during client deletion
            if (!clientID) {
                return cb(null);
            }

            db.models.OauthClient.findByIdAndUpdate(clientID, {
                $pull: { 
                    redirection_uris: {
                        $in: redirectURIIDs
                    }
                }
            }, {
                // To get updated client
                new: true
            }, function (err, updatedClient) {
                if (err) {
                    return cb(err);
                }

                cb(null, updatedClient);
            });
        }]
    }, function (err, results) {
        var updatedClient = results && results.updateRedirectURIsForClient;

        if (err) {
            return cb(err);
        }

        cb(null, updatedClient);
    });
};