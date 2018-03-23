var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');

var findOauthEntitiesID = require('../../../models/actions/findOauthEntitiesID');

var createOauthEntityID = require('../../../testUtils/db/createOauthEntityID');

var compareArray = require('../../../testUtils/lib/compareArray');

describe('models.actions.findOauthEntitiesID', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-object as find conditions', function () {
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID(v, 
                                    mongoose.Types.ObjectId(),
                                    mongoose.Types.ObjectId(), 
                                    function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID({},
                                    v, 
                                    mongoose.Types.ObjectId(), 
                                    function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as client ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID({},
                                    mongoose.Types.ObjectId(),
                                    v,
                                    function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                findOauthEntitiesID({},
                                    mongoose.Types.ObjectId(), 
                                    mongoose.Types.ObjectId(), 
                                    v);
            }, assert.AssertionError);
        });
    });

    it('returns empty array client doesn\'t have specific IDs for user', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        findOauthEntitiesID({}, userID, clientID, function (err, oauthEntitiesID) {
            if (err) {
                return done(err);
            }

            assert.ok(Type.is(oauthEntitiesID, Array));
            assert.strictEqual(oauthEntitiesID.length, 0);

            done();
        });
    });

    it('returns all oauth entities ID when no find conditions were passed', function (done) {
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        async.auto({
            createOauthEntityIDForUser: function (cb) {
                createOauthEntityID({
                    user: userID,
                    client: clientID,
                    real_id: mongoose.Types.ObjectId(),
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['users']
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            },

            // Make sure passed user ID was used
            createOauthEntityIDForAnotherUser: function (cb) {
                createOauthEntityID({
                    user: mongoose.Types.ObjectId(),
                    client: clientID,
                    real_id: mongoose.Types.ObjectId(),
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['users']
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            },

            // Make sure passed client ID were used
            createOauthEntityIDForAnotherClient: function (cb) {
                createOauthEntityID({
                    user: userID,
                    client: mongoose.Types.ObjectId(),
                    real_id: mongoose.Types.ObjectId(),
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['users']
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }
        }, function (err, results) {
            var oauthEntityIDForUser = results.createOauthEntityIDForUser;

            if (err) {
                return done(err);
            }

            findOauthEntitiesID({}, userID, clientID, function (err, oauthEntitiesID) {
                var oauthEntityID = oauthEntitiesID && oauthEntitiesID[0];

                if (err) {
                    return done(err);
                }

                // Make sure user and client ID were used
                assert.strictEqual(oauthEntitiesID.length, 1);

                assert.strictEqual(oauthEntityID.client.toString(), oauthEntityIDForUser.client.toString());
                assert.strictEqual(oauthEntityID.user.toString(), oauthEntityIDForUser.user.toString());

                assert.strictEqual(oauthEntityID.real_id.toString(), oauthEntityIDForUser.real_id.toString());
                assert.strictEqual(oauthEntityID.fake_id.toString(), oauthEntityIDForUser.fake_id.toString());

                assert.ok(compareArray(oauthEntityID.entities, oauthEntityIDForUser.entities));

                done();
            });
        });
    });
    
    it('returns specified oauth entities ID when find conditions were passed', function (done) {
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        async.auto({
            createOauthEntityIDForUser: function (cb) {
                createOauthEntityID({
                    user: userID,
                    client: clientID,
                    real_id: mongoose.Types.ObjectId(),
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['users']
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            },

            createOauthEntityIDForEmail: function (cb) {
                createOauthEntityID({
                    user: userID,
                    client: clientID,
                    real_id: mongoose.Types.ObjectId(),
                    fake_id: mongoose.Types.ObjectId(),
                    entities: ['emails']
                }, function (err, oauthEntityID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthEntityID);
                });
            }
        }, function (err, results) {
            var oauthEntityIDForUser = results.createOauthEntityIDForUser;

            if (err) {
                return done(err);
            }

            findOauthEntitiesID({
                entities: ['users']
            }, userID, clientID, function (err, oauthEntitiesID) {
                var oauthEntityID = oauthEntitiesID && oauthEntitiesID[0];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthEntitiesID.length, 1);

                assert.strictEqual(oauthEntityID.client.toString(), oauthEntityIDForUser.client.toString());
                assert.strictEqual(oauthEntityID.user.toString(), oauthEntityIDForUser.user.toString());

                assert.strictEqual(oauthEntityID.real_id.toString(), oauthEntityIDForUser.real_id.toString());
                assert.strictEqual(oauthEntityID.fake_id.toString(), oauthEntityIDForUser.fake_id.toString());
                
                assert.ok(compareArray(oauthEntityID.entities, oauthEntityIDForUser.entities));

                done();
            });
        });
    });
});