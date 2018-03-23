var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var async = require('async');

var resetOauthUserStatusForDeletedEntity = require('../../../models/actions/resetOauthUserStatusForDeletedEntity');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');
var findOauthUserStatus = require('../../../testUtils/db/findOauthUserStatus');

var createOauthUserStatusForUser = function (userID, entity, entityID, done) {
    var context = this;

    var status = 'existing_user_after_update';
    var clientID = mongoose.Types.ObjectId();
    
    var useTestAccount = false;
    var insert = {
        status: context.rootStatus || status,
        updated_fields: context.updatedFields || [entity]
    };

    insert['updated_' + entity] = context.entities || [{
        id: entityID,
        status: context.status || 'new',
        updated_fields: []
    }];

    createOauthUserStatus.call({
        insert: insert
    }, clientID, userID, status, 
    useTestAccount, done);
};

describe('models.actions.resetOauthUserStatusForDeletedEntity', function () {
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
                resetOauthUserStatusForDeletedEntity(v, 'addresses', 
                                                     mongoose.Types.ObjectId(),
                                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                resetOauthUserStatusForDeletedEntity(mongoose.Types.ObjectId(), 
                                                     v, mongoose.Types.ObjectId(),
                                                     function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity ID', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                resetOauthUserStatusForDeletedEntity(mongoose.Types.ObjectId(), 'addresses',
                                                     v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'non-function value as callback', function () {
        
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                resetOauthUserStatusForDeletedEntity(mongoose.Types.ObjectId(), 'addresses',
                                                     mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('prevents reset and update for '
       + 'clients which don\'t need it', function (done) {
        
        var userID = mongoose.Types.ObjectId();
        var addressID = mongoose.Types.ObjectId();

        var entity = 'addresses';

        async.auto({
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
            },

            resetOauthUserStatus: ['createUpdatedOauthUserStatus', 'createOtherUserOauthUserStatus',
                                   'createOtherAddressOauthUserStatus', function (cb, results) {

                resetOauthUserStatusForDeletedEntity(userID, entity, addressID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }]
        }, function (err, results) {
            var oauthUserStatus = results.createUpdatedOauthUserStatus;
            
            var oauthUserStatus2 = results.createOtherUserOauthUserStatus;
            var oauthUserStatus3 = results.createOtherAddressOauthUserStatus;

            var clients = [
                oauthUserStatus.client.toString(),
                oauthUserStatus2.client.toString(),
                oauthUserStatus3.client.toString(),
            ];

            if (err) {
                return done(err);
            }

            findOauthUserStatus(clients, [userID], function (err, oauthUserStatuss) {
                if (err) {
                    return done(err);
                }

                // `-1`: The one with other user id
                assert.strictEqual(oauthUserStatuss.length, clients.length - 1);

                oauthUserStatuss.forEach(function (userStatus) {
                    assert.strictEqual(userStatus.status, 'existing_user_after_update');
                    
                    assert.deepEqual(userStatus.updated_fields.toObject(), [entity]);

                    assert.strictEqual(userStatus['updated_' + entity].length, 1);
                });

                done();
            });
        });
    });

    it('resets oauth user status for '
       + 'clients which needs it', function (done) {
        
        var userID = mongoose.Types.ObjectId();
        var addressID = mongoose.Types.ObjectId();

        var entity = 'addresses';

        async.auto({
            // To be reseted
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

            // To be reseted
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

            resetOauthUserStatus: ['createOauthUserStatus', 
                                   'createOauthUserStatus2',
                                   function (cb, results) {

                resetOauthUserStatusForDeletedEntity(userID, entity, addressID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }]
        }, function (err, results) {
            var oauthUserStatus = results.createOauthUserStatus;
            
            var oauthUserStatus2 = results.createOauthUserStatus2;

            var clients = [
                oauthUserStatus.client.toString(),
                oauthUserStatus2.client.toString()
            ];

            if (err) {
                return done(err);
            }

            findOauthUserStatus(clients, [userID], function (err, oauthUserStatuss) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserStatuss.length, clients.length);

                oauthUserStatuss.forEach(function (userStatus) {
                    assert.strictEqual(userStatus.status, 'existing_user');

                    assert.deepEqual(userStatus.updated_fields.toObject(), []);
                    assert.deepEqual(userStatus['updated_' + entity].toObject(), []);
                });

                done();
            });
        });
    });
    
    it('updates oauth user status for '
       + 'clients which need it', function (done) {
        
        var userID = mongoose.Types.ObjectId();
        var addressID = mongoose.Types.ObjectId();

        var entity = 'addresses';

        async.auto({
            // Make sure it pulls 
            // from `update_fields` field
            createOauthUserStatus: function (cb) {
                createOauthUserStatusForUser.call({
                    updatedFields: ['first_name', entity]
                }, userID, entity, addressID, function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            },

            // Make sure it pulls 
            // from `update_{entityName}` field
            createOauthUserStatus2: function (cb) {
                createOauthUserStatusForUser.call({
                    entities: [{
                        id: addressID,
                        status: 'new',
                        updated_fields: []
                    }, {
                        id: mongoose.Types.ObjectId(),
                        status: 'new',
                        updated_fields: []
                    }]
                }, userID, entity, addressID, function (err, oauthUserStatus) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            },

            updateOauthUserStatus: ['createOauthUserStatus', 
                                    'createOauthUserStatus2',
                                    function (cb, results) {
                
                resetOauthUserStatusForDeletedEntity(userID, entity, 
                                                     addressID, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null);
                });
            }]
        }, function (err, results) {
            var oauthUserStatus = results.createOauthUserStatus;
            var oauthUserStatus2 = results.createOauthUserStatus2;

            var clients = [
                oauthUserStatus.client.toString(),
                oauthUserStatus2.client.toString()
            ];

            if (err) {
                return done(err);
            }

            findOauthUserStatus(clients, [userID], function (err, oauthUserStatuss) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(oauthUserStatuss.length, clients.length);

                oauthUserStatuss.forEach(function (userStatus) {
                    assert.strictEqual(userStatus.status, 'existing_user_after_update');

                    // Make sure it pulls
                    // from `update_fields` field
                    if (oauthUserStatus.client.toString() === userStatus.client.toString()) {

                        assert.deepEqual(userStatus.updated_fields.toObject(), ['first_name']);
                        assert.deepEqual(userStatus['updated_' + entity].toObject(), []);

                        return;
                    }

                    // Make sure it pulls 
                    // from `update_{entityName}` field
                    assert.deepEqual(userStatus.updated_fields.toObject(), [entity]);

                    assert.strictEqual(userStatus['updated_' + entity].length, 1);
                });

                done();
            });
        });
    });
});