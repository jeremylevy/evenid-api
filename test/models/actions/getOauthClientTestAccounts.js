var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');
var moment = require('moment');

var getOauthClientTestAccounts = require('../../../models/actions/getOauthClientTestAccounts');

var createOauthClientTestAccountLog = require('../../../testUtils/db/createOauthClientTestAccountLog');
var createOauthClient = require('../../../testUtils/db/createOauthClient');

var removeOauthUserEventCollection = require('../../../testUtils/db/removeOauthUserEventCollection');

describe('models.actions.getOauthClientTestAccounts', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `getOauthClientTestAccounts` 
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
                getOauthClientTestAccounts(
                    v,  
                    function () {}
                );
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                getOauthClientTestAccounts(
                    mongoose.Types.ObjectId(),  
                    v
                );
            }, assert.AssertionError);
        });
    });

    it('returns `0` when statistics are not set for client', function (done) {
        var expectedNbOfTestAccounts = {
            registered: 0,
            converted: 0
        };

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

                getOauthClientTestAccounts(oauthClient.id, function (err, nbOfTestAccounts) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, nbOfTestAccounts);
                });
            }]
        }, function (err, results) {
            var nbOfTestAccounts = results && results.getNbOfOauthClientRegisteredUsers;

            if (err) {
                return done(err);
            }

            assert.deepEqual(nbOfTestAccounts.toObject(), expectedNbOfTestAccounts);

            done();
        });
    });

    it('returns the number of test accounts for client', function (done) {
        var expectedNbOfTestAccounts = {
            registered: 8,
            converted: 4
        };

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient.call({
                    statistics: {
                        test_accounts: expectedNbOfTestAccounts
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

                getOauthClientTestAccounts(oauthClient.id, function (err, nbOfTestAccounts) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, nbOfTestAccounts);
                });
            }]
        }, function (err, results) {
            var nbOfTestAccounts = results && results.getNbOfOauthClientRegisteredUsers;

            if (err) {
                return done(err);
            }

            assert.deepEqual(nbOfTestAccounts.toObject(), expectedNbOfTestAccounts);

            done();
        });
    });
});