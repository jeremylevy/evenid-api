var request = require('supertest');
var assert = require('assert');

var async = require('async');

var config = require('../../../../../config');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var findOauthEntitiesID = require('../../../../../testUtils/db/findOauthEntitiesID');

var createAddress = require('../../../../../testUtils/users/createAddress');
var deleteAddress = require('../../../../../testUtils/users/deleteAddress');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;

describe('GET /users/:user_id (User status) (After deleted entity)', function () {
    before(function (done) {
        makeARequest = function (app, accessToken, userID, statusCode, done) {
            var cb = function (err, accessToken, userID) {
                if (err) {
                    return done(err);
                }

                request(app)
                    .get('/users/' + userID)
                    .set('Authorization', 'Bearer ' + accessToken)
                    .expect('Content-Type', 'application/json; charset=utf-8')
                    .expect('Cache-Control', 'no-store')
                    .expect('Pragma', 'no-cache')
                    .expect(statusCode, function (err, resp) {
                        if (err) {
                            return done(err);
                        }

                        assert.doesNotThrow(function () {
                            JSON.parse(resp.text);
                        });

                        done(null, resp.body);
                    });
            };

            cb(null, accessToken, userID);
        };

        done();
    });
    
    it('doesn\'t change anything when '
       + 'status is set to `new_user`', function (done) {

        async.auto({
            // First, user give access to one client
            getOauthClientAccessToken: function (cb) {
                getOauthClientAccessToken.call({
                    redirectionURIScope: ['addresses'],
                    // We want two addresses given 
                    // that we will remove one
                    redirectionURIScopeFlags: ['separate_shipping_billing_address']
                }, function (err, resp) {
                    
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            },

            deleteAddress: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;
                var app = resp.app;
                var user = resp.user;

                deleteAddress(app)(resp.appAccessToken, user.id, user.addresses[1].id, cb);
            }]
        }, function (err, results) {
            var resp = results && results.getOauthClientAccessToken;

            if (err) {
                return done(err);
            }

            makeARequest(resp.app, resp.accessToken, resp.fakeUserID, 200, function (err, user) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.status, 'new_user');
                assert.deepEqual(user.updated_fields, []);

                assert.strictEqual(user.addresses.length, 1);
                assert.strictEqual(user.addresses[0].status, 'new');

                done();
            });
        });  
    });
    
    it('returns deleted as status when '
       + '`existing_user` status', function (done) {

        async.auto({
            // First, user give access to one client
            getOauthClientAccessToken: function (cb) {
                getOauthClientAccessToken.call({
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: []
                }, function (err, resp) {
                    
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            },

            createAddress: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;
                
                createAddress(resp.app, function (cb) {
                    return cb(null, resp.appAccessToken, resp.user)
                })(function (err, accessToken, userID, addressID, addressLine1) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, addressID);
                });
            }],

            createAddress2: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;
                
                createAddress(resp.app, function (cb) {
                    return cb(null, resp.appAccessToken, resp.user)
                })(function (err, accessToken, userID, addressID, addressLine1) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, addressID);
                });
            }],

            findAddressFakeID: ['createAddress', function (cb, results) {
                var addressID = results.createAddress;

                findOauthEntitiesID({
                    real_id: addressID
                }, function (err, oauthEntitiesId) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesId.length, 1);

                    cb(null, oauthEntitiesId[0].fake_id);
                });
            }],

            findAddress2FakeID: ['createAddress2', function (cb, results) {
                var address2ID = results.createAddress2;

                findOauthEntitiesID({
                    real_id: address2ID
                }, function (err, oauthEntitiesId) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesId.length, 1);

                    cb(null, oauthEntitiesId[0].fake_id);
                });
            }],

            // From `new_user` to `existing_user`
            getUser: ['findAddressFakeID', 'findAddress2FakeID', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                makeARequest(resp.app, resp.accessToken, resp.fakeUserID, 200, cb);
            }],

            deleteAddresses: ['getUser', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                var addressID = results.createAddress;
                var address2ID = results.createAddress2;

                var app = resp.app;
                var user = resp.user;

                deleteAddress(app)(resp.appAccessToken, user.id, addressID, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    deleteAddress(app)(resp.appAccessToken, user.id, address2ID, cb);
                });
            }]
        }, function (err, results) {
            var resp = results && results.getOauthClientAccessToken;

            var addressFakeID = results && results.findAddress2FakeID;
            var addressFakeID2 = results && results.findAddress2FakeID;

            if (err) {
                return done(err);
            }

            makeARequest(resp.app, resp.accessToken, resp.fakeUserID, 200, function (err, user) {
                var deletedAddresses = [];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.status, 'existing_user_after_update');
                
                assert.deepEqual(user.updated_fields, ['addresses']);

                assert.strictEqual(user.addresses.length, 3);

                user.addresses.forEach(function (address) {
                    if (address.status !== 'deleted') {
                        return;
                    }

                    assert.strictEqual(Object.keys(address).length, 3);

                    assert.deepEqual(address.updated_fields, []);

                    deletedAddresses.push(address.id);
                });

                // Make sure the two 
                // addresses were deleted
                [addressFakeID, addressFakeID2].forEach(function (addressID) {
                    deletedAddresses.splice(deletedAddresses.indexOf(addressID), 1);
                });

                assert.strictEqual(deletedAddresses.length, 0);

                done();
            });
        });  
    });
    
    it('resets user status when new address is '
       + 'deleted before client has viewed it', function (done) {

        async.auto({
            // First, user give access to one client
            getOauthClientAccessToken: function (cb) {
                getOauthClientAccessToken.call({
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: []
                }, function (err, resp) {
                    
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            },

            findAddressFakeID: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                var user = resp.user;

                findOauthEntitiesID({
                    real_id: user.addresses[0].id
                }, function (err, oauthEntitiesId) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesId.length, 1);

                    cb(null, oauthEntitiesId[0].fake_id);
                });
            }],

            // From `new_user` to `existing_user`
            getUser: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                makeARequest(resp.app, resp.accessToken, resp.fakeUserID, 200, cb);
            }],

            // From `existing_user` to `existing_user_after_update`
            createAddress: ['getUser', function (cb, results) {
                var resp = results.getOauthClientAccessToken;
                
                createAddress(resp.app, function (cb) {
                    return cb(null, resp.appAccessToken, resp.user)
                })(function (err, accessToken, userID, addressID, addressLine1) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, addressID);
                });
            }],

            // From `existing_user_after_udpate` to `existing_user`
            deleteAddresses: ['createAddress', function (cb, results) {
                var resp = results.getOauthClientAccessToken;
                var addressID = results.createAddress;

                var app = resp.app;
                var user = resp.user;

                deleteAddress(app)(resp.appAccessToken, user.id, addressID, cb);
            }]
        }, function (err, results) {
            var resp = results && results.getOauthClientAccessToken;
            var addressID = results && results.findAddressFakeID;

            if (err) {
                return done(err);
            }

            makeARequest(resp.app, resp.accessToken, resp.fakeUserID, 200, function (err, user) {
                var deletedAddresses = [];

                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.status, 'existing_user');
                
                assert.deepEqual(user.updated_fields, []);

                assert.strictEqual(user.addresses.length, 1);

                assert.strictEqual(user.addresses[0].id, addressID.toString());
                assert.strictEqual(user.addresses[0].status, 'old');

                assert.deepEqual(user.addresses[0].updated_fields, []);

                done();
            });
        });  
    });
});