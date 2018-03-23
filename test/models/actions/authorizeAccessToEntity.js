var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var async = require('async');

var config = require('../../../config');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var authorizeAccessToEntity = require('../../../models/actions/authorizeAccessToEntity');

var createUserAuthorization = require('../../../testUtils/db/createUserAuthorization');
var findUserAuthorizations = require('../../../testUtils/db/findUserAuthorizations');

var findOauthEntitiesID = require('../../../testUtils/db/findOauthEntitiesID');

var compareArray = require('../../../testUtils/lib/compareArray');

describe('models.actions.authorizeAccessToEntity', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid '
       + 'value as user authorization entity name', function () {
        
        var entityName = 'emails';
        var entityID = mongoose.Types.ObjectId();
        var clientIDs = [mongoose.Types.ObjectId()];
        var userID = mongoose.Types.ObjectId();
        var cb = function () {};

        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                authorizeAccessToEntity(v, entityName, entityID, 
                                        clientIDs, userID, cb);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity name', function () {
        
        var userAuthorizationEntityName = 'emails';
        var entityID = mongoose.Types.ObjectId();
        var clientIDs = [mongoose.Types.ObjectId()];
        var userID = mongoose.Types.ObjectId();
        var cb = function () {};

        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                authorizeAccessToEntity(userAuthorizationEntityName, v, 
                                        entityID, clientIDs, userID, cb);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as entity ID', function () {
        
        var userAuthorizationEntityName = 'emails';
        var entityName = 'emails';
        var clientIDs = [mongoose.Types.ObjectId()];
        var userID = mongoose.Types.ObjectId();
        var cb = function () {};

        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                authorizeAccessToEntity(userAuthorizationEntityName, entityName, 
                                        v, clientIDs, userID, cb);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as client IDs', function () {
        
        var userAuthorizationEntityName = 'emails';
        var entityName = 'emails';
        var entityID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();
        var cb = function () {};

        [null, undefined, {}, 9, [], ['bar'], 'bar'].forEach(function (v) {
            assert.throws(function () {
                authorizeAccessToEntity(userAuthorizationEntityName, entityName, 
                                        entityID, v, userID, cb);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as user ID', function () {
        
        var userAuthorizationEntityName = 'emails';
        var entityName = 'emails';
        var entityID = mongoose.Types.ObjectId();
        var clientIDs = [mongoose.Types.ObjectId()];
        var cb = function () {};

        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                authorizeAccessToEntity(userAuthorizationEntityName, entityName, 
                                        entityID, clientIDs, v, cb);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'invalid value as callback', function () {
        
        var userAuthorizationEntityName = 'emails';
        var entityName = 'emails';
        var entityID = mongoose.Types.ObjectId();
        var clientIDs = [mongoose.Types.ObjectId()];
        var userID = mongoose.Types.ObjectId();

        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                authorizeAccessToEntity(userAuthorizationEntityName, entityName, 
                                        entityID, clientIDs, userID, v);
            }, assert.AssertionError);
        });
    });

    it('authorizes access to entity for passed clients', function (done) {
        var userAuthorizationEntityName = 'phone_numbers';
        var entityName = 'mobile_phone_numbers';
        var entityID = mongoose.Types.ObjectId();
        var clientIDs = [];
        var userID = null;

        var toStringFn = function (v) {
            return v.toString();
        };
        
        async.auto({
            // Authorize one client
            createUserAuthorization: function (cb) {
                createUserAuthorization(function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    userID = userAuthorization.user;

                    clientIDs.push(userAuthorization.client.toString());

                    cb(null, userAuthorization);
                });
            },

            // And another for the same user
            createUserAuthorization2: ['createUserAuthorization',
                                       function (cb, results) {
                
                var userAuthorization = results.createUserAuthorization;

                createUserAuthorization.call({
                    // Authorize another client for same user
                    user: {
                        _id: userAuthorization.user
                    }
                },function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    clientIDs.push(userAuthorization.client.toString());

                    cb(null, userAuthorization);
                });
            }],

            authorizeAccessToEntity: ['createUserAuthorization',
                                      'createUserAuthorization2',
                                      function (cb, results) {
                
                var userAuthorization = results.createUserAuthorization;

                authorizeAccessToEntity(userAuthorizationEntityName, entityName,
                                        entityID, clientIDs, userID, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            assertUserAuthWasUpdated: ['authorizeAccessToEntity',
                                       function (cb, results) {
                
                findUserAuthorizations([userID], function (err, userAuthorizations) {
                    var receivedClientIDs = [];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(userAuthorizations.length, 2);

                    userAuthorizations.forEach(function (userAuthorization) {
                        var phoneNumberIDs = [];

                        receivedClientIDs.push(userAuthorization.client);

                        phoneNumberIDs = userAuthorization.entities
                                                          .phone_numbers
                                                          .map(toStringFn);

                        // Make sure entity was added
                        assert.ok(phoneNumberIDs.indexOf(entityID.toString()) !== -1);
                    });

                    assert.ok(compareArray(clientIDs, receivedClientIDs));

                    cb();
                });
            }],

            assertEntitiesIDWereSet: ['authorizeAccessToEntity',
                                      function (cb, results) {
                
                findOauthEntitiesID({
                    user: userID,
                    client: {
                        $in: clientIDs,
                    },
                    real_id: entityID,
                    entities: entityName
                }, function (err, entityIDs) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(entityIDs.length, 2);

                    entityIDs.forEach(function (entityID) {
                        // Make sure fake ID was generated
                        assert.ok(areValidObjectIDs([entityID.fake_id]));
                    });

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