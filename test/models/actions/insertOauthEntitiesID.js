var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var insertOauthEntitiesID = require('../../../models/actions/insertOauthEntitiesID');

var findOauthEntitiesID = require('../../../testUtils/db/findOauthEntitiesID');

describe('models.actions.insertOauthEntitiesID', function () {
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
       + 'non-object value as `authorizedEntities`', function () {
        
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthEntitiesID(v, 
                                      mongoose.Types.ObjectId(), 
                                      mongoose.Types.ObjectId(), 
                                      function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthEntitiesID({},
                                      v,
                                      mongoose.Types.ObjectId(), 
                                      function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as clientID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                insertOauthEntitiesID({},
                                      mongoose.Types.ObjectId(), 
                                      v, 
                                      function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                insertOauthEntitiesID({},
                                      mongoose.Types.ObjectId(), 
                                      mongoose.Types.ObjectId(), 
                                      v);
            }, assert.AssertionError);
        });
    });

    it('insert entities ID when valid values', function (done) {
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        var emailID = mongoose.Types.ObjectId();
        var phoneNumberID = mongoose.Types.ObjectId();
        var addressID = mongoose.Types.ObjectId();

        var insertedEntities = {
            users: [userID],
            unknown_phone_numbers: [phoneNumberID],
            emails: [emailID],
            addresses: [addressID]
        };

        async.auto({
            insertOauthEntitiesID: function (cb) {
                insertOauthEntitiesID(insertedEntities, userID, clientID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            },

            assertEntitiesIDWereInserted: ['insertOauthEntitiesID', function (cb) {
                findOauthEntitiesID({
                    user: userID,
                    client: clientID
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    // Email, phone number, address and user
                    assert.strictEqual(oauthEntitiesID.length, 4);

                    cb();
                });
            }],

            // Insert exactly the same entities than above
            // in order to check for duplicates
            assertItPreventsDuplicates: ['insertOauthEntitiesID', function (cb) {
                insertOauthEntitiesID(insertedEntities, userID, clientID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    findOauthEntitiesID({
                        user: userID,
                        client: clientID
                    }, function (err, oauthEntitiesID) {
                        if (err) {
                            return cb(err);
                        }

                        // Email, phone number, address and user
                        assert.strictEqual(oauthEntitiesID.length, 4);

                        cb();
                    });
                });
            }],

            // If client update redirection uri scope afterwards,
            // user may use THE SAME phone number as `unknown_phone_numbers` one time
            // and as `mobile_phone_numbers` or `landline_phone_numbers` another time.
            // So make sure to update entity accordingly 
            // and to not include entity in the update conditions.
            assertItUpdatesEntityForPhoneNumber: ['assertItPreventsDuplicates', function (cb) {
                insertOauthEntitiesID({
                    mobile_phone_numbers: [phoneNumberID]
                }, userID, clientID, function (err) {
                    findOauthEntitiesID({
                        user: userID,
                        client: clientID,
                        real_id: phoneNumberID,
                        // Make sure entity has been updated
                        entities: ['unknown_phone_numbers', 'mobile_phone_numbers']
                    }, function (err, oauthEntitiesID) {
                        if (err) {
                            return cb(err);
                        }

                        // Email, phone number, address and user
                        assert.strictEqual(oauthEntitiesID.length, 1);

                        cb();
                    });
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('uses the same entities ID that when test account was used', function (done) {
        var userID = mongoose.Types.ObjectId();
        var clientID = mongoose.Types.ObjectId();

        var emailID = mongoose.Types.ObjectId();
        var phoneNumberID = mongoose.Types.ObjectId();
        var addressID = mongoose.Types.ObjectId();

        var insertedEntities = {
            users: [userID],
            unknown_phone_numbers: [phoneNumberID],
            emails: [emailID],
            addresses: [addressID],
            use_test_account: false
        };

        async.auto({
            insertTestAccountOauthEntitiesID: function (cb) {
                insertedEntities.use_test_account = true;

                insertOauthEntitiesID(insertedEntities, userID, clientID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            },

            assertTestAccountEntitiesIDWereInserted: ['insertTestAccountOauthEntitiesID', function (cb) {
                findOauthEntitiesID({
                    user: userID,
                    client: clientID,
                    use_test_account: true
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    // Email, phone number, address and user
                    assert.strictEqual(oauthEntitiesID.length, 4);

                    cb(null, oauthEntitiesID);
                });
            }],

            // Insert exactly the same entities than above
            // in order to check that this function reuses the same IDs 
            // when test account was used
            assertItReusesTheSameIDs: ['assertTestAccountEntitiesIDWereInserted', function (cb, results) {
                var insertedTestEntities = results.assertTestAccountEntitiesIDWereInserted;
                var fakeIDs = [];

                insertedEntities.use_test_account = false;

                // Make sure it reuses the same IDs
                insertedTestEntities.forEach(function (entity) {
                    fakeIDs.push(entity.fake_id);
                });

                insertOauthEntitiesID(insertedEntities, userID, clientID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    findOauthEntitiesID({
                        user: userID,
                        client: clientID,
                        // Make sure it reuses the same IDs
                        fake_id: {
                            $in: fakeIDs
                        }
                    }, function (err, oauthEntitiesID) {
                        if (err) {
                            return cb(err);
                        }

                        // Email, phone number, address and user
                        assert.strictEqual(oauthEntitiesID.length, 4);

                        // Make sure test account records were removed
                        oauthEntitiesID.forEach(function (entityID) {
                            assert.strictEqual(entityID.use_test_account, false);
                        });

                        cb();
                    });
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