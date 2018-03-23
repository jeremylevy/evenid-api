var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var removeOauthClient = require('../../../models/actions/removeOauthClient');

var createUser = require('../../../testUtils/db/createUser');
var createOauthAuthorization = require('../../../testUtils/db/createOauthAuthorization');
var createOauthClient = require('../../../testUtils/db/createOauthClient');
var createOauthRedirectionURI = require('../../../testUtils/db/createOauthRedirectionURI');
var createOauthHook = require('../../../testUtils/db/createOauthHook');

var findOauthClients = require('../../../testUtils/db/findOauthClients');
var findOauthRedirectionURIs = require('../../../testUtils/db/findOauthRedirectionURIs');
var findOauthHooks = require('../../../testUtils/db/findOauthHooks');
var findOauthAuthorizations = require('../../../testUtils/db/findOauthAuthorizations');
var findUsers = require('../../../testUtils/db/findUsers');

describe('models.actions.removeOauthClient', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid oauth client', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {

                removeOauthClient(v, 
                                  mongoose.Types.ObjectId(), 
                                  function () {});

            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid developer ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {

                removeOauthClient({
                    _id: mongoose.Types.ObjectId()
                }, v, function () {});

            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {

                removeOauthClient({
                    _id: mongoose.Types.ObjectId()
                }, mongoose.Types.ObjectId(), v);

            }, assert.AssertionError);
        });
    });

    it('remove client and associated entities when passing valid client', function (done) {
        async.auto({

            /* First, we create all entities associated to client */

            createOauthRedirectionURI: function (cb) {
                createOauthRedirectionURI(function (err, oauthRedirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthRedirectionURI);
                });
            },

            createOauthHook: function (cb) {
                createOauthHook(function (err, oauthHook) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthHook);
                });
            },

            createOauthClient: ['createOauthRedirectionURI', 
                                'createOauthHook',
                                function (cb, results) {

                var oauthRedirectionURI = results.createOauthRedirectionURI;
                var oauthHook = results.createOauthHook;

                createOauthClient.call({
                    redirection_uris: [oauthRedirectionURI.id],
                    hooks: [oauthHook.id]
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            }],

            createDeveloper: ['createOauthClient', 
                              function (cb, results) {
                
                var client = results.createOauthClient;

                createUser.call({
                    user: {
                        password: 'azerty',
                        developer: {
                            clients: [client.id, mongoose.Types.ObjectId()]
                        },
                        authorized_clients: [client.id, mongoose.Types.ObjectId()],
                        is_developer: true
                    }
                }, function (err, developer) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, developer);
                });
            }],

            createOauthAuthorization: ['createDeveloper', 
                                       function (cb, results) {
                
                var oauthClient = results.createOauthClient;
                var developer = results.createDeveloper;

                createOauthAuthorization.call({
                    client: oauthClient,
                    user: developer
                }, function (err, authorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, authorization);
                });
            }],

            // Then, we remove the created client
            removeOauthClient: ['createOauthAuthorization', 
                                function (cb, results) {
                
                var client = results.createOauthClient;
                var developer = results.createDeveloper;

                removeOauthClient(client, developer.id, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            // We assert that oauth client was removed
            assertOauthClientWasRemoved: ['removeOauthClient', 
                                          function (cb, results) {
                
                var client = results.createOauthClient;

                findOauthClients([client.id], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 0);

                    cb();
                });
            }],

            // We assert that redirection uris were removed
            assertOauthRedirectionURIsWereRemoved: ['removeOauthClient', 
                                                    function (cb, results) {
                
                var oauthRedirectionURI = results.createOauthRedirectionURI;

                findOauthRedirectionURIs([oauthRedirectionURI.id], 
                                          function (err, oauthRedirectionURIs) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthRedirectionURIs.length, 0);

                    cb();
                });
            }],

            // We assert that hooks were removed
            assertOauthHooksWereRemoved: ['removeOauthClient', 
                                          function (cb, results) {
                
                var oauthHook = results.createOauthHook;

                findOauthHooks([oauthHook.id], 
                                function (err, oauthHooks) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthHooks.length, 0);

                    cb();
                });
            }],

            // We assert that oauth authorizations were removed
            assertOauthAuthorizationsWereRemoved: ['removeOauthClient', 
                                                   function (cb, results) {
                
                var oauthAuthorization = results.createOauthAuthorization;

                findOauthAuthorizations([oauthAuthorization.id], function (err, oauthAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthAuthorizations.length, 0);

                    cb();
                });
            }],

            // We assert that user authorized 
            // and owned clients were updated accordingly
            assertUserOwnedAuthorizedClientsWereUpdated: ['removeOauthClient', 
                                                          function (cb, results) {
                
                var user = results.createDeveloper;

                findUsers([user.id], function (err, users) {
                    var user = !err && users[0];
                    
                    if (err) {
                        return cb(err);
                    }

                    // User was created with two clients
                    // One who was deleted and another
                    assert.strictEqual(user.developer.clients.length, 1);
                    assert.strictEqual(user.authorized_clients.length, 1);

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});