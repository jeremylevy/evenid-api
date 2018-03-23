var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var async = require('async');

var findClientsWhichHaveNotGetEntity = require('../../../models/actions/findClientsWhichHaveNotGetEntity');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');

var createOauthUserStatusForUser = function (userID, entity, entityID, done) {
    var context = this;

    var status = 'existing_user_after_update';
    var clientID = mongoose.Types.ObjectId();
    
    var useTestAccount = false;
    var insert = {
        updated_fields: [entity]
    };

    insert['updated_' + entity] = [{
        id: entityID,
        status: context.status || 'new',
        updated_fields: []
    }];

    createOauthUserStatus.call({
        insert: insert
    }, clientID, userID, status, 
    useTestAccount, done);
};

describe('models.actions.findClientsWhichHaveNotGetEntity', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing '
       + 'non-ObjectID as userID', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findClientsWhichHaveNotGetEntity(v, 'addresses', 
                                                 mongoose.Types.ObjectId(),
                                                 function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findClientsWhichHaveNotGetEntity(mongoose.Types.ObjectId(), 
                                                 v, mongoose.Types.ObjectId(),
                                                 function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity ID', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findClientsWhichHaveNotGetEntity(mongoose.Types.ObjectId(), 'addresses',
                                                 v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findClientsWhichHaveNotGetEntity(mongoose.Types.ObjectId(), 'addresses',
                                                 mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('returns an empty array when no clients', function (done) {
        findClientsWhichHaveNotGetEntity(mongoose.Types.ObjectId(),
                                        'addresses',
                                         mongoose.Types.ObjectId(),
                                         function (err, clients) {
            if (err) {
                return done(err);
            }

            assert.ok(compareArray(clients, []));

            done();
        });
    });

    it('returns clients which have not get entity', function (done) {
        var userID = mongoose.Types.ObjectId();
        var addressID = mongoose.Types.ObjectId();

        var entity = 'addresses';

        async.auto({
            // To be returned
            createOauthUserStatus: function (cb) {
                createOauthUserStatusForUser(userID, entity,
                                             addressID,
                                             function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            },

            // To be returned
            createOauthUserStatus2: function (cb) {
                createOauthUserStatusForUser(userID, entity,
                                             addressID,
                                             function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            },

            // Make sure oauth user status is used
            createUpdatedOauthUserStatus: function (cb) {
                createOauthUserStatusForUser.call({
                    status: 'updated'
                }, userID, entity,
                addressID, function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            },

            // Make sure user id is used
            createOtherUserOauthUserStatus: function (cb) {
                var userID = mongoose.Types.ObjectId();

                createOauthUserStatusForUser(userID, entity, 
                                             addressID, function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            },

            // Make sure entity id is used
            createOtherAddressOauthUserStatus: function (cb) {
                var addressID = mongoose.Types.ObjectId();

                createOauthUserStatusForUser(userID, entity, 
                                             addressID, function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            }
        }, function (err, results) {
            var oauthUserStatus = results.createOauthUserStatus;
            var oauthUserStatus2 = results.createOauthUserStatus2;

            var expectedClients = [
                oauthUserStatus.client.toString(),
                oauthUserStatus2.client.toString()
            ];

            if (err) {
                return done(err);
            }

            findClientsWhichHaveNotGetEntity(userID, entity, 
                                             addressID, function (err, clients) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(clients.length, 2);

                assert.ok(compareArray(clients, expectedClients));

                done();
            });
        });
    });
});