var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var authorizeAccessToEntity = require('../../../../../models/middlewares/pre/save/authorizeAccessToEntity');

var createAddress = require('../../../../../testUtils/db/createAddress');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var createUser = require('../../../../../testUtils/db/createUser');
var createOauthClient = require('../../../../../testUtils/db/createOauthClient');

var findUserAuthorizations = require('../../../../../testUtils/db/findUserAuthorizations');
var findOauthEntitiesID = require('../../../../../testUtils/db/findOauthEntitiesID');

describe('models.middlewares.pre.save.authorizeAccessToEntity', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('does not authorize access '
       + 'to entity during update', function (done) {

        async.auto({
            createUser: function (cb) {
                createUser(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, user);
                });
            },

            createOauthClient: function (cb) {
                createOauthClient(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    return cb(null, client);
                });
            },

            createAddress: ['createUser', function (cb, results) {
                var user = results.createUser;

                createAddress.call({
                    user: user.id
                }, function (err, address) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, address);
                });
            }],

            createUserAuthorization: ['createUser',
                                      'createOauthClient',
                                      // If user auth is created before
                                      // address, address will 
                                      // be authorized for client.
                                      'createAddress',
                                      function (cb, results) {
                
                var user = results.createUser;
                var client = results.createOauthClient;

                createUserAuthorization.call({
                    user: user,
                    client: client,
                    scope: ['addresses'],
                    entities: {
                        emails: [],
                        phone_numbers: [],
                        addresses: [mongoose.Types.ObjectId()]
                    }
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    // The middleware needs 
                    // populated client
                    userAuthorization.client = client;

                    cb(null, userAuthorization);
                });
            }],

            authorizeAccessToEntity: ['createAddress',
                                      'createUserAuthorization',
                                      function (cb, results) {
                                        
                var address = results.createAddress;
                var userAuthorization = results.createUserAuthorization;

                address._granted_authorizations = [
                    userAuthorization
                ];

                authorizeAccessToEntity('addresses').call(address, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            assertItHasNotUpdatedUserAuth: ['authorizeAccessToEntity',
                                            function (cb, results) {
                
                var createdUserAuth = results.createUserAuthorization;
                var toStringFn = function (v) {
                    return v.toString();
                };

                findUserAuthorizations([createdUserAuth.user],
                                       function (err, userAuthorizations) {
                    
                    var userAuthorization = !err && userAuthorizations[0];
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(userAuthorizations.length, 1);

                    assert.deepEqual(userAuthorization.entities
                                                      .addresses
                                                      .map(toStringFn),
                                     createdUserAuth.entities
                                                    .addresses
                                                    .map(toStringFn));

                    cb();
                });
            }],

            assertItHasNotCreatedEntityID: ['authorizeAccessToEntity',
                                            function (cb, results) {

                var user = results.createUser;
                var client = results.createOauthClient;

                findOauthEntitiesID({
                    user: user.id,
                    client: client.id
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesID.length, 0);

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