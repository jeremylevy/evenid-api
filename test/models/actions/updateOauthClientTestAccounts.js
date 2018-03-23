var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var moment = require('moment-timezone');

var updateOauthClientTestAccounts = require('../../../models/actions/updateOauthClientTestAccounts');

var createOauthClient = require('../../../testUtils/db/createOauthClient');
var findOauthClients = require('../../../testUtils/db/findOauthClients');

var createUser = require('../../../testUtils/db/createUser');

var findOauthClientTestAccountsAtDate = require('../../../testUtils/db/findOauthClientTestAccountsAtDate');
var removeOauthClientTestAccountCollection = require('../../../testUtils/db/removeOauthClientTestAccountCollection');

var today = moment.tz(new Date(), 'UTC')
                  .startOf('day')
                  .toDate();

var testUpdateFn = function (type, nb, done) {
    var nbOfTestAccountsAtStart = {
        registered: 8,
        converted: 4
    };

    var userID = mongoose.Types.ObjectId().toString();

    async.auto({
        createOauthClient: function (cb) {
            createOauthClient.call({
                statistics: {
                    test_accounts: nbOfTestAccountsAtStart
                }
            }, function (err, oauthClient) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthClient);
            });
        },

        addTestAccountLog: ['createOauthClient', function (cb, results) {
            var oauthClient = results.createOauthClient;

            updateOauthClientTestAccounts(userID, oauthClient.id, 
                                          type, nb, function (err, newCount) {
                
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(newCount, nbOfTestAccountsAtStart[type] + nb);

                cb(null);
            });
        }],

        assertOauthClientWasUpdated: ['addTestAccountLog', function (cb, results) {
            var oauthClient = results.createOauthClient;

            findOauthClients([oauthClient.id], function (err, clients) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(clients.length, 1);

                assert.strictEqual(clients[0].statistics.test_accounts[type],
                                   nbOfTestAccountsAtStart[type] + nb);

                cb(null);
            });
        }],

        assertOauthClientTestAccountWasUpdated: ['addTestAccountLog', function (cb, results) {
            var oauthClient = results.createOauthClient;
            
            findOauthClientTestAccountsAtDate(oauthClient.id, today, function (err, testAccounts) {
                var testAccount = testAccounts.length && testAccounts[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(testAccounts.length, 1);

                assert.strictEqual(testAccount.count[type],
                                   nbOfTestAccountsAtStart[type] + nb);

                assert.strictEqual(testAccount.previous_count[type],
                                   nbOfTestAccountsAtStart[type]);

                cb(null);
            });
        }],

        // To make sure that `previous_count`
        // field is set only during insert
        addAnotherTestAccountLog: ['assertOauthClientWasUpdated',
                                   'assertOauthClientTestAccountWasUpdated',
                                   function (cb, results) {
            
            var oauthClient = results.createOauthClient;

            updateOauthClientTestAccounts(userID, oauthClient.id, 
                                          type, nb, function (err, newCount) {
                
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(newCount, nbOfTestAccountsAtStart[type] + (nb * 2));

                cb(null);
            });
        }],

        assertPreviousCountWasNotUpdated: ['addAnotherTestAccountLog', function (cb, results) {
            var oauthClient = results.createOauthClient;

            findOauthClientTestAccountsAtDate(oauthClient.id, today, function (err, testAccounts) {
                var testAccount = testAccounts.length && testAccounts[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(testAccounts.length, 1);

                assert.strictEqual(testAccount.count[type],
                                   nbOfTestAccountsAtStart[type] + (nb * 2));

                // Make sure previous count 
                // is set only during insert
                assert.strictEqual(testAccount.previous_count[type],
                                   nbOfTestAccountsAtStart[type]);

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return done(err);
        }

        done();
    });
};

describe('models.actions.updateOauthClientTestAccounts', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `updateOauthClientTestAccounts`
            // query is based on date
            // make sure `OauthClientTestAccount` collection is empty
            removeOauthClientTestAccountCollection(function (err) {
                if (err) {
                    return done(err);
                }

                done();
            });
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientTestAccounts(v,
                                              mongoose.Types.ObjectId().toString(),
                                              'registered',
                                              1,
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientTestAccounts(mongoose.Types.ObjectId().toString(),
                                              v,
                                              'registered',
                                              1,
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid test account category', function () {
        [null, undefined, {}, 0, 8.8, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientTestAccounts(mongoose.Types.ObjectId().toString(),
                                              mongoose.Types.ObjectId().toString(),
                                              v,
                                              1,
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid value as nb', function () {
        [null, undefined, {}, 0, 8.8, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientTestAccounts(mongoose.Types.ObjectId().toString(),
                                              mongoose.Types.ObjectId().toString(),
                                              'registered',
                                              v,
                                              function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientTestAccounts(mongoose.Types.ObjectId().toString(),
                                              mongoose.Types.ObjectId().toString(),
                                              'registered',
                                              1,
                                              v);
            }, assert.AssertionError);
        });
    });

    it('works for registered event', function (done) {
        testUpdateFn('registered', 1, done);
    });

    it('works for converted event', function (done) {
        testUpdateFn('converted', 1, done);
    });

    it('doesnt update if user is client owner', function (done) {
        var nbOfTestAccountsAtStart = {
            registered: 8,
            converted: 4
        };

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient.call({
                    statistics: {
                        test_accounts: nbOfTestAccountsAtStart
                    }
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            },

            createUser: ['createOauthClient', function (cb, results) {
                var oauthClient = results.createOauthClient;

                createUser.call({
                    user: {
                        developer: {
                            clients: [oauthClient.id]
                        },
                        is_developer: true
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            addTestAccountLog: ['createUser', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var user = results.createUser;

                var nbToAdd = 1;

                updateOauthClientTestAccounts(user.id, oauthClient.id, 'registered',
                                              nbToAdd, function (err, newCount) {
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(newCount, undefined);

                    cb(null);
                });
            }],

            assertOauthClientWasNotUpdated: ['addTestAccountLog', function (cb, results) {
                var oauthClient = results.createOauthClient;

                findOauthClients([oauthClient.id], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assert.strictEqual(clients[0].statistics.test_accounts.registered,
                                       nbOfTestAccountsAtStart.registered);

                    cb(null);
                });
            }],

            assertOauthClientTestAccountWasNotUpdated: ['addTestAccountLog', function (cb, results) {
                var oauthClient = results.createOauthClient;
                
                findOauthClientTestAccountsAtDate(oauthClient.id, today, function (err, testAccounts) {
                    var testAccount = testAccounts.length && testAccounts[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(testAccounts.length, 0);

                    cb(null);
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