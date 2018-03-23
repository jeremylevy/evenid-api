var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../config');

var db = require('../');

var ClientEntityIDForUser = require('../../libs/clientEntityIDForUser');

var ServerError = require('../../errors/types/ServerError');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (authorizedEntities, userID, clientID, cb) {
    assert.ok(Type.is(authorizedEntities, Object),
              'argument `authorizedEntities` must be an object literal');

    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');

    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var fns = [];
    var insertErrors = [];

    var userUseTestAccount = !!authorizedEntities.use_test_account;

    var clientEntityIDForUser = null;

    // We need to use the same IDs 
    // when user use test account
    // and after it has registered for real
    var GetFakeID = function (oauthEntitiesID) {
        // Construct the function
        clientEntityIDForUser = ClientEntityIDForUser(oauthEntitiesID);

        return function (entity) {
            return clientEntityIDForUser(entity, 'fake') 
                || mongoose.Types.ObjectId();
        };
    };
    var getFakeID = null;

    // {users: [USER_ID], unknown_phone_numbers: [],
    // mobile_phone_numbers: [], landline_phone_numbers: [], 
    // emails: [], addresses: []}
    Object.keys(authorizedEntities).forEach(function (entity) {
        // Array of ObjectIDs
        var entities = authorizedEntities[entity] || [];

        // Make sure to delete non array value
        // Avoid `has no method 'forEach'` error
        if (['use_test_account'].indexOf(entity) !== -1) {
            return;
        }

        entities.forEach(function (entityID) {
            fns.push(function (cb) {
                if (!userUseTestAccount) {
                    db.models.OauthEntityID.update({
                        user: userID,
                        client: clientID,
                        real_id: entityID
                    }, {
                        // Only set if insert
                        $setOnInsert: {
                            user: userID,
                            client: clientID,
                            real_id: entityID,
                            // We need to use the same IDs when user use test account
                            // and after it has registered for real
                            fake_id: getFakeID(entity),
                            use_test_account: false
                        },

                        // If client update redirection uri scope afterwards,
                        // user may use THE SAME phone number 
                        // as `unknown_phone_number` one time
                        // and as `mobile_phone_number` 
                        // or `landline_phone_number` another time.
                        // So make sure to update entity accordingly 
                        // and to not include entity in the update conditions.
                        $addToSet: {
                            entities: entity
                        }
                    }, {
                        // Whether to create the doc if it doesn't exist
                        upsert: true
                    }, function (err, rawResponse) {
                        // `async.parallel` call main 
                        // callback for each errors. Avoid it.
                        if (err) {
                            insertErrors.push(err);
                        }

                        cb(null);
                    });

                    return;
                }

                // Why insert if not exists ?
                // If user uses test account many times
                // we don't want MongoDB to trigger an unique index error
                // for `user_1_client_1_real_id` index.
                db.models.OauthEntityID.update({
                    user: userID,
                    client: clientID,
                    real_id: entityID
                }, {
                    // Only set if insert
                    $setOnInsert: {
                        user: userID,
                        client: clientID,
                        real_id: entityID,
                        fake_id: entity === 'users'
                            // Given that passed entity ID is 
                            // real user ID not the test account ID 
                            // (which is not created at this time) we needs 
                            // to generate an ID for the users entity.
                            ? mongoose.Types.ObjectId()
                            // If user uses test account 
                            // TestAccount model entities ID 
                            // will be used as fake IDs. So, at the time 
                            // user uses test account, real IDs (TestAccount model entities ID)
                            // equals fake IDs (TestAccount model entities ID).
                            : entityID,
                        use_test_account: true
                    },

                    // See above, why entities are updated here.
                    $addToSet: {
                        entities: entity
                    }
                }, {
                    // Whether to create the doc if it doesn't exist
                    upsert: true
                }, function (err, rawResponse) {
                    // `async.parallel` call main 
                    // callback for each errors. Avoid it.
                    if (err) {
                        insertErrors.push(err);
                    }

                    cb(null);
                });
            });
        });
    });

    if (!fns.length) {
        return cb(null, 0);
    }

    async.auto({
        findTestAccountEntitiesID: function (cb) {
            if (userUseTestAccount) {
                return cb(null);
            }

            db.models.OauthEntityID.find({
                user: userID,
                client: clientID,
                use_test_account: true
            }, function (err, oauthEntitiesID) {
                if (err) {
                    return cb(err);
                }

                // Construct the function
                getFakeID = GetFakeID(oauthEntitiesID);

                cb(null, oauthEntitiesID);
            });
        },

        // If client update redirection uri scope
        // after test but before user register for real
        // we may need to add more entity ID than during testing
        // so prefere to delete all test account entities ID and 
        // to create others.
        deleteTestAccountEntitiesID: ['findTestAccountEntitiesID', function (cb, results) {
            var testAccountEntitiesID = results.findTestAccountEntitiesID;

            if (userUseTestAccount 
                || !testAccountEntitiesID.length) {
                
                return cb(null);
            }

            db.models.OauthEntityID.remove({
                user: userID,
                client: clientID,
                use_test_account: true
            }, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }],

        // Given that we reuse the test account entities ID, 
        // make sure to delete it before creation
        // given that `fake_id` MUST be unique
        createEntitiesID: ['deleteTestAccountEntitiesID', function (cb, results) {
            async.parallel(fns, function (err) {
                if (insertErrors.length) {
                    // Unmanaged errors. The error middleware 
                    // will responds with `server_error`.
                    return cb(new ServerError(insertErrors));
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};