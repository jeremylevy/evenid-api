var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var NotFoundError = require('../../../errors/types/NotFoundError');

var removeAddress = require('../../../models/actions/removeAddress');

var compareArray = require('../../../testUtils/lib/compareArray');

var createAddress = require('../../../testUtils/db/createAddress');
var createUser = require('../../../testUtils/db/createUser');

var createOauthAuthorization = require('../../../testUtils/db/createOauthAuthorizationRaw');
var createUserAuthorization = require('../../../testUtils/db/createUserAuthorization');

var createOauthUserStatus = require('../../../testUtils/db/createOauthUserStatus');
var findOauthUserStatus = require('../../../testUtils/db/findOauthUserStatus');

var findAddresses = require('../../../testUtils/db/findAddresses');
var findUsers = require('../../../testUtils/db/findUsers');

var findOauthAuthorizations = require('../../../testUtils/db/findOauthAuthorizations');
var findUserAuthorizations = require('../../../testUtils/db/findUserAuthorizations');

describe('models.actions.removeAddress', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid address ID', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeAddress(v, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                removeAddress(mongoose.Types.ObjectId(), v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                removeAddress(mongoose.Types.ObjectId(), mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('returns not found error when address doesn\'t exist', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            removeAddress(mongoose.Types.ObjectId(), user.id, function (err, updatedUser) {
                assert.ok(err && !updatedUser);

                assert.ok(err instanceof NotFoundError);

                done();
            });
        });
    });

    it('remove address when passed valid address ID', function (done) {
        var clientID = mongoose.Types.ObjectId();

        async.auto({
            createAddress: function (cb) {
                createAddress(function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            },

            createAddress2: function (cb) {
                createAddress(function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            },

            createAddress3: function (cb) {
                createAddress(function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            },

            createUser: ['createAddress', 'createAddress2', 'createAddress3', function (cb, results) {
                var address = results.createAddress;
                var address2 = results.createAddress2;
                var address3 = results.createAddress3;

                createUser.call({
                    user: {
                        password: 'azerty',
                        addresses: [address._id, address2._id, address3._id]
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            /* Make sure it pulls from ALL oauth authorizations */

            createOauthAuthorization: ['createUser', function (cb, results) {
                var user = results.createUser;
                var address = results.createAddress;
                var address2 = results.createAddress2;
                var address3 = results.createAddress3;

                createOauthAuthorization({                    
                    issued_for: user.id,
                    type: 'token',
                    scope: ['addresses'],
                    user: {
                        addresses: [{
                            address: address.id,
                            for: ['shipping']
                        }, {
                            address: address2.id,
                            for: ['shipping']
                        }, {
                            address: address3.id,
                            for: ['shipping']
                        }]
                    }
                }, function (err, oauthAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthAuthorization);
                });
            }],

            createOauthAuthorization2: ['createUser', function (cb, results) {
                var user = results.createUser;
                var address = results.createAddress;

                createOauthAuthorization({                    
                    issued_for: user.id,
                    type: 'token',
                    scope: ['addresses'],
                    user: {
                        addresses: [{
                            address: address.id,
                            for: ['shipping']
                        }]
                    }
                }, function (err, oauthAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthAuthorization);
                });
            }],

            /* END */

            /* Make sure it pulls from ALL user authorizations */

            createUserAuthorization: ['createUser', function (cb, results) {
                var user = results.createUser;
                var address = results.createAddress;

                var address2 = results.createAddress2;
                var address3 = results.createAddress3;

                createUserAuthorization.call({
                    user: user,
                    scope: ['addresses'],
                    entities: {
                        addresses: [address.id, address2.id, address3.id]
                    }
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            createUserAuthorization2: ['createUser', function (cb, results) {
                var user = results.createUser;
                var address = results.createAddress;

                createUserAuthorization.call({
                    user: user,
                    scope: ['addresses'],
                    entities: {
                        addresses: [address.id]
                    }
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            /* END */

            /* Make sure it resets oauth user status if required */

            createOauthUserStatus: ['createUser', function (cb, results) {
                var user = results.createUser;
                var address = results.createAddress;
                
                var useTestAccount = false;

                createOauthUserStatus.call({
                    insert: {
                        updated_fields: ['addresses'],
                        updated_addresses: [{
                            id: address.id,
                            status: 'new',
                            udpated_fields: []
                        }]
                    }
                }, clientID, user.id, 'existing_user_after_update', false, cb);
            }],

            /* END */

            // Remove first address
            removeAddress: ['createOauthAuthorization', 'createOauthAuthorization2', 
                            'createUserAuthorization', 'createUserAuthorization2',
                            function (cb, results) {
                
                var address = results.createAddress;
                var address2 = results.createAddress2;

                var user = results.createUser;

                removeAddress(address._id, user._id, function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }],

            findAddresses: ['removeAddress', function (cb, results) {
                var address = results.createAddress;

                findAddresses([address._id],
                              function (err, addresses) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, addresses);
                });
            }],

            findUser: ['removeAddress', function (cb, results) {
                var user = results.createUser;

                findUsers([user._id], function (err, users) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, users[0]);
                });
            }],

            /* Make sure it pulls from ALL oauth authorizations */

            findOauthAuthorization: ['removeAddress', function (cb, results) {
                var oauthAuthorization = results.createOauthAuthorization;

                findOauthAuthorizations([oauthAuthorization.id], function (err, oauthAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthAuthorizations[0]);
                });
            }],

            findOauthAuthorization2: ['removeAddress', function (cb, results) {
                var oauthAuthorization = results.createOauthAuthorization2;

                findOauthAuthorizations([oauthAuthorization.id], function (err, oauthAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthAuthorizations[0]);
                });
            }],

            /* END */

            /* Make sure it pulls from ALL user authorizations */

            findUserAuthorization: ['removeAddress', function (cb, results) {
                var userAuthorization = results.createUserAuthorization;

                findUserAuthorizations.call({
                    findConditions: {
                        _id: userAuthorization._id
                    }
                }, [], function (err, userAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorizations[0]);
                });
            }],

            findUserAuthorization2: ['removeAddress', function (cb, results) {
                var userAuthorization = results.createUserAuthorization2;

                findUserAuthorizations.call({
                    findConditions: {
                        _id: userAuthorization._id
                    }
                }, [], function (err, userAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorizations[0]);
                });
            }],

            /* END */

            /* Make sure it resets oauth user status */

            findOauthUserStatus: ['removeAddress', function (cb, results) {
                var user = results.createUser;

                findOauthUserStatus(clientID, user.id, function (err, oauthUserStatus) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus);
                });
            }]
        }, function (err, results) {
            var address2 = results.createAddress2;
            var address3 = results.createAddress3;

            var addresses = results.findAddresses;
            var user = results.findUser;

            var oauthAuthorization = results.findOauthAuthorization;
            var oauthAuthorization2 = results.findOauthAuthorization2;

            var userAuthorization = results.findUserAuthorization;
            var userAuthorization2 = results.findUserAuthorization2;

            var updatedUser = results.removeAddress;
            var oauthUserStatus = results.findOauthUserStatus;

            if (err) {
                return done(err);
            }

            /* Make sure first address was deleted */
            
            assert.strictEqual(addresses.length, 0);

            /* Make sure user addresses contain only the third */
            
            assert.strictEqual(user.addresses.length, 2);
            assert.strictEqual(user.addresses[0].toString(), address2.id);
            assert.strictEqual(user.addresses[1].toString(), address3.id);

            /* Check that udpated user returned by 
              `removeAddress` function is the same 
               than those found */
            
            assert.strictEqual(updatedUser.id, user.id);

            // `toObject()`: Returns a native js Array.
            assert.ok(compareArray(updatedUser.addresses.toObject(), 
                                   user.addresses.toObject()));

            // Make sure it pulls from oauth authorization
            assert.strictEqual(oauthAuthorization.user.addresses.length, 2);
            assert.strictEqual(oauthAuthorization.user.addresses[0].address.toString(), address2.id);
            assert.strictEqual(oauthAuthorization.user.addresses[1].address.toString(), address3.id);

            // Make sure it pulls from ALL oauth authorizations
            assert.strictEqual(oauthAuthorization2.user.addresses.length, 0);

            // Make sure it pulls from user authorization
            assert.strictEqual(userAuthorization.entities.addresses.length, 2);
            assert.strictEqual(userAuthorization.entities.addresses[0].toString(), address2.id);
            assert.strictEqual(userAuthorization.entities.addresses[1].toString(), address3.id);

            // Make sure it pulls from ALL user authorizations
            assert.strictEqual(userAuthorization2.entities.addresses.length, 0);

            /* Make sure it resets oauth user status */
            assert.strictEqual(oauthUserStatus.status, 'existing_user');

            assert.strictEqual(oauthUserStatus.updated_fields.length, 0);
            assert.strictEqual(oauthUserStatus.updated_addresses.length, 0);

            done();
        });
    });
});