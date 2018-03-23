var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var moment = require('moment-timezone');

var updateOauthClientRegisteredUsers = require('../../../models/actions/updateOauthClientRegisteredUsers');

var createOauthClient = require('../../../testUtils/db/createOauthClient');
var findOauthClients = require('../../../testUtils/db/findOauthClients');

var createUser = require('../../../testUtils/db/createUser');

var findOauthClientRegisteredUsersAtDate = require('../../../testUtils/db/findOauthClientRegisteredUsersAtDate');
var removeOauthClientRegisteredUserCollection = require('../../../testUtils/db/removeOauthClientRegisteredUserCollection');

var today = moment.tz(new Date(), 'UTC')
                  .startOf('day')
                  .toDate();

var testUpdateFn = function (nb, done) {
    var nbOfRegisteredUsersAtStart = 8;

    var userID = mongoose.Types.ObjectId().toString();

    async.auto({
        createOauthClient: function (cb) {
            createOauthClient.call({
                statistics: {
                    registered_users: nbOfRegisteredUsersAtStart
                }
            }, function (err, oauthClient) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthClient);
            });
        },

        addRegistrationLog: ['createOauthClient', function (cb, results) {
            var oauthClient = results.createOauthClient;

            updateOauthClientRegisteredUsers(userID, oauthClient.id, nb, function (err, newCount) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(newCount, nbOfRegisteredUsersAtStart + nb);

                cb(null);
            });
        }],

        assertOauthClientWasUpdated: ['addRegistrationLog', function (cb, results) {
            var oauthClient = results.createOauthClient;

            findOauthClients([oauthClient.id], function (err, clients) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(clients.length, 1);

                assert.strictEqual(clients[0].statistics.registered_users,
                                   nbOfRegisteredUsersAtStart + nb);

                cb(null);
            });
        }],

        assertOauthClientRegisteredUserWasUpdated: ['addRegistrationLog', function (cb, results) {
            var oauthClient = results.createOauthClient;
            
            findOauthClientRegisteredUsersAtDate(oauthClient.id, today, function (err, registeredUsers) {
                var registeredUser = registeredUsers.length && registeredUsers[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(registeredUsers.length, 1);

                assert.strictEqual(registeredUser.count,
                                   nbOfRegisteredUsersAtStart + nb);

                assert.strictEqual(registeredUser.previous_count,
                                   nbOfRegisteredUsersAtStart);

                cb(null);
            });
        }],

        // To make sure that `previous_count`
        // field is set only during insert
        addAnotherRegistrationLog: ['assertOauthClientWasUpdated',
                                    'assertOauthClientRegisteredUserWasUpdated',
                                    function (cb, results) {
            
            var oauthClient = results.createOauthClient;

            updateOauthClientRegisteredUsers(userID, oauthClient.id, nb, function (err, newCount) {
                
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(newCount, nbOfRegisteredUsersAtStart + (nb * 2));

                cb(null);
            });
        }],

        assertPreviousCountWasNotUpdated: ['addAnotherRegistrationLog', function (cb, results) {
            var oauthClient = results.createOauthClient;

            findOauthClientRegisteredUsersAtDate(oauthClient.id, today, function (err, registeredUsers) {
                var registeredUser = registeredUsers.length && registeredUsers[0];

                if (err) {
                    return cb(err);
                }

                assert.strictEqual(registeredUsers.length, 1);

                assert.strictEqual(registeredUser.count,
                                   nbOfRegisteredUsersAtStart + (nb * 2));

                // Make sure previous count 
                // is set only during insert
                assert.strictEqual(registeredUser.previous_count,
                                   nbOfRegisteredUsersAtStart);

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

describe('models.actions.updateOauthClientRegisteredUsers', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            // Because `updateOauthClientRegisteredUsers`
            // query is based on date
            // make sure `OauthClientRegisteredUser` collection is empty
            removeOauthClientRegisteredUserCollection(function (err) {
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
                updateOauthClientRegisteredUsers(v,
                                                mongoose.Types.ObjectId().toString(),
                                                1,
                                                function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientRegisteredUsers(mongoose.Types.ObjectId().toString(),
                                                v,
                                                1,
                                                function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid value as nb', function () {
        [null, undefined, {}, 0, 8.8, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientRegisteredUsers(mongoose.Types.ObjectId().toString(),
                                                mongoose.Types.ObjectId().toString(),
                                                v,
                                                function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                updateOauthClientRegisteredUsers(mongoose.Types.ObjectId().toString(),
                                                mongoose.Types.ObjectId().toString(),
                                                1,
                                                v);
            }, assert.AssertionError);
        });
    });

    it('works for registration', function (done) {
        testUpdateFn(1, done);
    });

    it('works for deregistration', function (done) {
        testUpdateFn(-1, done);
    });

    it('doesnt update if user is client owner', function (done) {
        var nbOfRegisteredUsersAtStart = 8;

        async.auto({
            createOauthClient: function (cb) {
                createOauthClient.call({
                    statistics: {
                        registered_users: nbOfRegisteredUsersAtStart
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

            addRegistrationLog: ['createUser', function (cb, results) {
                var oauthClient = results.createOauthClient;
                var user = results.createUser;

                var nbToAdd = 1;

                updateOauthClientRegisteredUsers(user.id, oauthClient.id, 
                                                nbToAdd, function (err, newCount) {
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(newCount, undefined);

                    cb(null);
                });
            }],

            assertOauthClientWasNotUpdated: ['addRegistrationLog', function (cb, results) {
                var oauthClient = results.createOauthClient;

                findOauthClients([oauthClient.id], function (err, clients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(clients.length, 1);

                    assert.strictEqual(clients[0].statistics.registered_users,
                                       nbOfRegisteredUsersAtStart);

                    cb(null);
                });
            }],

            assertOauthClientRegisteredUserWasNotUpdated: ['addRegistrationLog', function (cb, results) {
                var oauthClient = results.createOauthClient;
                
                findOauthClientRegisteredUsersAtDate(oauthClient.id, today, function (err, registeredUsers) {
                    var registeredUser = registeredUsers.length && registeredUsers[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(registeredUsers.length, 0);

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