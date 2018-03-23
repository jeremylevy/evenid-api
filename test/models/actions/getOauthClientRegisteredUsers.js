var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment');

var getOauthClientRegisteredUsers = require('../../../models/actions/getOauthClientRegisteredUsers');

var createOauthClientRegisteredUserLog = require('../../../testUtils/db/createOauthClientRegisteredUserLog');
var createOauthClient = require('../../../testUtils/db/createOauthClient');

var removeOauthUserEventCollection = require('../../../testUtils/db/removeOauthUserEventCollection');

describe('models.actions.getOauthClientRegisteredUsers', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `getOauthClientRegisteredUsers` 
            // query is based on date
            // make sure `OauthUserEvent` collection is empty
            removeOauthUserEventCollection(function (err) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });

    it('throws an exception when passing non-ObjectID as client ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                getOauthClientRegisteredUsers(
                    v,  
                    function () {}
                );
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                getOauthClientRegisteredUsers(
                    mongoose.Types.ObjectId(),  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('returns `0` when statistics are not set for client', function (done) {
        var expectedNbOfRegisteredUsers = 0;

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient(function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, oauthClient);
                });
            },

            getNbOfOauthClientRegisteredUsers: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;

                getOauthClientRegisteredUsers(oauthClient.id, function (err, nbOfRegisteredUsers) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, nbOfRegisteredUsers);
                });
            }]
        }, function (err, results) {
            var nbOfRegisteredUsers = results && results.getNbOfOauthClientRegisteredUsers;

            if (err) {
                return done(err);
            }

            assert.strictEqual(nbOfRegisteredUsers, expectedNbOfRegisteredUsers);

            done();
        });
    });

    it('returns the number of registered users for client', function (done) {
        var expectedNbOfRegisteredUsers = 8;

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient.call({
                    statistics: {
                        registered_users: expectedNbOfRegisteredUsers
                    }
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            },

            getNbOfOauthClientRegisteredUsers: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;

                getOauthClientRegisteredUsers(oauthClient.id, function (err, nbOfRegisteredUsers) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, nbOfRegisteredUsers);
                });
            }]
        }, function (err, results) {
            var nbOfRegisteredUsers = results && results.getNbOfOauthClientRegisteredUsers;

            if (err) {
                return done(err);
            }

            assert.strictEqual(nbOfRegisteredUsers, expectedNbOfRegisteredUsers);

            done();
        });
    });
});