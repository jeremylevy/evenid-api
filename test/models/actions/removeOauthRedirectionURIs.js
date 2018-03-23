var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var removeOauthRedirectionURIs = require('../../../models/actions/removeOauthRedirectionURIs');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthRedirectionURI = require('../../../testUtils/db/createOauthRedirectionURI');
var createOauthClient = require('../../../testUtils/db/createOauthClient');

var findOauthRedirectionURIs = require('../../../testUtils/db/findOauthRedirectionURIs');
var findOauthClients = require('../../../testUtils/db/findOauthClients');

describe('models.actions.removeOauthRedirectionURIs', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid redirection URIs ID', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthRedirectionURIs(v, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid non-false client ID', function () {
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthRedirectionURIs([mongoose.Types.ObjectId()], v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                removeOauthRedirectionURIs([mongoose.Types.ObjectId()], mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('remove redirection URIs when passed valid redirection URIs ID', function (done) {
        async.auto({
            /* We create three hooks 
               and we remove only the first and the second */

            createOauthRedirectionURI: function (cb) {
                createOauthRedirectionURI(function (err, oauthRedirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURI);
                });
            },

            createOauthRedirectionURI2: function (cb) {
                createOauthRedirectionURI(function (err, oauthRedirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURI);
                });
            },

            createOauthRedirectionURI3: function (cb) {
                createOauthRedirectionURI(function (err, oauthRedirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURI);
                });
            },

            // Add redirection uris to client
            createOauthClient: ['createOauthRedirectionURI', 
                                'createOauthRedirectionURI2', 
                                'createOauthRedirectionURI3', 
                                function (cb, results) {

                var oauthRedirectionURI = results.createOauthRedirectionURI;
                var oauthRedirectionURI2 = results.createOauthRedirectionURI2;
                var oauthRedirectionURI3 = results.createOauthRedirectionURI3;

                createOauthClient.call({
                    redirection_uris: [oauthRedirectionURI._id, 
                                       oauthRedirectionURI2._id, 
                                       oauthRedirectionURI3._id]
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            }],

            // Only remove the first and the second redirection uri
            removeOauthRedirectionURIs: ['createOauthClient', function (cb, results) {
                var oauthRedirectionURI = results.createOauthRedirectionURI;
                var oauthRedirectionURI2 = results.createOauthRedirectionURI2;
                var client = results.createOauthClient;

                removeOauthRedirectionURIs([oauthRedirectionURI._id, 
                                            oauthRedirectionURI2._id], 
                                            client._id, 
                                            function (err, updatedClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedClient);
                });
            }],

            // Make sure first and second redirection uri were removed
            findOauthRedirectionURIs: ['removeOauthRedirectionURIs', function (cb, results) {
                var oauthRedirectionURI = results.createOauthRedirectionURI;
                var oauthRedirectionURI2 = results.createOauthRedirectionURI2;
                var oauthRedirectionURI3 = results.createOauthRedirectionURI3;

                findOauthRedirectionURIs([oauthRedirectionURI._id, 
                                          oauthRedirectionURI2._id, 
                                          oauthRedirectionURI3._id], 
                                          function (err, oauthRedirectionURIs) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURIs);
                });
            }],

            // Make sure client's redirection uris were updated accordingly
            findOauthClient: ['removeOauthRedirectionURIs', function (cb, results) {
                var client = results.createOauthClient;

                findOauthClients([client._id], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, clients[0]);
                });
            }]
        }, function (err, results) {
            var oauthRedirectionURI3 = results.createOauthRedirectionURI3;
            var oauthRedirectionURIs = results.findOauthRedirectionURIs;
            var client = results.findOauthClient;
            var updatedClient = results.removeOauthRedirectionURIs;

            if (err) {
                return done(err);
            }

            /* Make sure found redirection uris contain only
               the third */
            
            assert.strictEqual(oauthRedirectionURIs.length, 1);
            assert.strictEqual(oauthRedirectionURIs[0].id, 
                               oauthRedirectionURI3.id);

            /* Make sure client redirection uris contain only
               the third */
            
            assert.strictEqual(client.redirection_uris.length, 1);
            assert.strictEqual(client.redirection_uris[0].toString(), 
                               oauthRedirectionURI3.id);

            /* Check that udpated client returned by `removeOauthRedirectionURIs` function
               is the same than those found */
            
            assert.strictEqual(updatedClient.id, client.id);
            // `toObject()`: Returns a native js Array.
            assert.ok(compareArray(updatedClient.redirection_uris.toObject(), 
                                   client.redirection_uris.toObject()));

            done();
        });
    });
});