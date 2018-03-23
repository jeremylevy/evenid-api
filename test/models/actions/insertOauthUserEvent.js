var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var insertOauthUserEvent = require('../../../models/actions/insertOauthUserEvent');

var createUser = require('../../../testUtils/db/createUser');
var findOauthUserEvents = require('../../../testUtils/db/findOauthUserEvents');

describe('models.actions.insertOauthUserEvent', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthUserEvent(v,
                                     mongoose.Types.ObjectId(),
                                     'login', 
                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthUserEvent(mongoose.Types.ObjectId(),
                                     v, 
                                     'login', 
                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid value as type', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthUserEvent(mongoose.Types.ObjectId(),
                                     mongoose.Types.ObjectId(), 
                                     v, 
                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                insertOauthUserEvent(mongoose.Types.ObjectId(),
                                     mongoose.Types.ObjectId(), 
                                     'login', 
                                     v);
            }, assert.AssertionError);
        });
    });

    it('doesn\'t insert oauth user event when user is client owner', function (done) {
        var userID = null;
        var clientID = mongoose.Types.ObjectId();

        var eventType = 'login';

        async.auto({
            createUser: function (cb) {
                createUser.call({
                    user: {
                        developer: {
                            clients: [clientID]
                        },
                        is_developer: true
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    userID = user.id;

                    cb(null, user);
                });
            },

            insertOauthUserEvent: ['createUser', function (cb) {
                insertOauthUserEvent(userID, clientID, eventType, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    assert.ok(!oauthUserEvent);

                    cb(null);
                });
            }],

            assertEventWasNotInserted: ['insertOauthUserEvent', function (cb) {
                findOauthUserEvents({
                    user: userID,
                    client: clientID,
                    type: eventType
                }, function (err, oauthUserEvents) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserEvents.length, 0);
                    
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

    it('inserts oauth user event when valid values', function (done) {
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        var eventType = 'login';

        var isValidOauthUserEvent = function (oauthUserEvent) {
            assert.strictEqual(oauthUserEvent.user.toString(), userID.toString());
            assert.strictEqual(oauthUserEvent.client.toString(), clientID.toString());
            assert.strictEqual(oauthUserEvent.type, eventType);
        };

        async.auto({
            insertOauthUserEvent: function (cb) {
                insertOauthUserEvent(userID, clientID, eventType, function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    isValidOauthUserEvent(oauthUserEvent);

                    cb(null, oauthUserEvent);
                });
            },

            assertEventWasInserted: ['insertOauthUserEvent', function (cb) {
                findOauthUserEvents({
                    user: userID,
                    client: clientID,
                    type: eventType
                }, function (err, oauthUserEvents) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserEvents.length, 1);
                    
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