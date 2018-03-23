var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var removeOauthHooks = require('../../../models/actions/removeOauthHooks');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthHook = require('../../../testUtils/db/createOauthHook');
var createOauthClient = require('../../../testUtils/db/createOauthClient');

var findOauthHooks = require('../../../testUtils/db/findOauthHooks');
var findOauthClients = require('../../../testUtils/db/findOauthClients');

describe('models.actions.removeOauthHooks', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid oauth hooks ID', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthHooks(v, 
                                 mongoose.Types.ObjectId(), 
                                 function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid non-false client ID', function () {
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeOauthHooks([mongoose.Types.ObjectId()], 
                                 v, 
                                 function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                removeOauthHooks([mongoose.Types.ObjectId()], 
                                 mongoose.Types.ObjectId(), 
                                 v);
            }, assert.AssertionError);
        });
    });

    it('remove hooks when passed valid hook IDs', function (done) {
        async.auto({
            /* We create three hooks 
               and we remove only the first and the second */

            createOauthHook: function (cb) {
                createOauthHook.call({
                    // To check that function update the client's
                    // `update_notification_handler` property when deleted
                    eventType: 'USER_DID_UPDATE_PERSONAL_INFORMATION'
                }, function (err, oauthHook) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthHook);
                });
            },

            createOauthHook2: function (cb) {
                createOauthHook(function (err, oauthHook) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthHook);
                });
            },

            createOauthHook3: function (cb) {
                createOauthHook(function (err, oauthHook) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthHook);
                });
            },

            // Add hooks to client
            createOauthClient: ['createOauthHook', 
                                'createOauthHook2', 
                                'createOauthHook3', 
                                function (cb, results) {

                var oauthHook = results.createOauthHook;
                var oauthHook2 = results.createOauthHook2;
                var oauthHook3 = results.createOauthHook3;

                createOauthClient.call({
                    hooks: [oauthHook._id, 
                            oauthHook2._id, 
                            oauthHook3._id],
                    // Check that function update the client's
                    // `update_notification_handler` property
                    update_notification_handler: oauthHook.url
                }, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            }],

            // Only remove the first and the second
            removeOauthHooks: ['createOauthClient', function (cb, results) {
                var oauthHook = results.createOauthHook;
                var oauthHook2 = results.createOauthHook2;
                var client = results.createOauthClient;

                removeOauthHooks([oauthHook._id, 
                                  oauthHook2._id], 
                                  client._id, 
                                  function (err, updatedClient) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedClient);
                });
            }],

            // Make sure first and second hook were removed
            findOauthHooks: ['removeOauthHooks', function (cb, results) {
                var oauthHook = results.createOauthHook;
                var oauthHook2 = results.createOauthHook2;
                var oauthHook3 = results.createOauthHook3;

                findOauthHooks([oauthHook._id, 
                                oauthHook2._id, 
                                oauthHook3._id], 
                                function (err, oauthHooks) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthHooks);
                });
            }],

            // Make sure client's hooks were updated accordingly
            findOauthClient: ['removeOauthHooks', function (cb, results) {
                var client = results.createOauthClient;

                findOauthClients([client._id], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, clients[0]);
                });
            }]
        }, function (err, results) {
            var oauthHook3 = results.createOauthHook3;
            var oauthHooks = results.findOauthHooks;
            var client = results.findOauthClient;
            var updatedClient = results.removeOauthHooks;

            if (err) {
                return done(err);
            }

            /* Make sure found hooks 
               contain only the third */
            
            assert.strictEqual(oauthHooks.length, 1);
            assert.strictEqual(oauthHooks[0].id, oauthHook3.id);

            /* Make sure client's hooks 
               contain only the third */
            
            assert.strictEqual(client.hooks.length, 1);
            assert.strictEqual(client.hooks[0].toString(), oauthHook3.id);

            // Check that function update the client's
            // `update_notification_handler` property
            assert.ok(!client.update_notification_handler);

            /* Check that udpated client returned by `removeOauthHooks` 
               function is the same than those found */
            
            assert.strictEqual(updatedClient.id, client.id);

            // `toObject()`: Returns a native js Array.
            assert.ok(compareArray(updatedClient.hooks.toObject(), 
                                   client.hooks.toObject()));

            done();
        });
    });
});