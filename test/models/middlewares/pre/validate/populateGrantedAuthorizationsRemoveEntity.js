var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var db = require('../../../../../models');

var populateGrantedAuthorizations = require('../../../../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var createUser = require('../../../../../testUtils/db/createUser');
var createEmail = require('../../../../../testUtils/db/createEmail');

var createPhoneNumber = require('../../../../../testUtils/db/createPhoneNumber');
var createAddress = require('../../../../../testUtils/db/createAddress');

var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');
var createOauthUserStatus = require('../../../../../testUtils/db/createOauthUserStatus');

var user = null;

var assertItHasPopulated = function (entityType, entity, cb) {
    async.auto({
        // One client wants entity type
        // and has called the GET user API method to 
        // retrieve the removed entity
        createUserAuthorization: function (cb, results) {
            var entities = {
                emails: [],
                phone_numbers: [],
                addresses: []
            };

            entities[entityType] = entity.id;

            createUserAuthorization.call({
                user: user,
                scope: [entityType],
                entities: entities
            }, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            });
        },

        // Create another authorization to ensure that
        // granted authorizations contains 
        // only authorizations for clients which 
        // have called the GET user API method to 
        // retrieve the removed entity
        createUserAuthorization2: ['createUserAuthorization', function (cb, results) {
            var entities = {
                emails: [],
                phone_numbers: [],
                addresses: []
            };

            entities[entityType] = entity.id;

            createUserAuthorization.call({
                user: user,
                scope: [entityType],
                entities: entities
            }, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            });
        }],

        // Create Oauth user status to ensure that
        // granted authorizations contains 
        // only authorizations for clients which 
        // have called the GET user API method to 
        // retrieve the removed entity
        createOauthUserStatus: ['createUserAuthorization', 
                                'createUserAuthorization2',
                                function (cb, results) {

            var userAuthorization2 = results.createUserAuthorization2;
            var status = 'existing_user_after_update';
            
            var useTestAccount = false;
            var insert = {};

            insert['updated_' + entityType] = [{
                id: entity.id,
                status: 'new',
                updated_fields: []
            }];

            createOauthUserStatus.call({
                insert: insert
            }, userAuthorization2.client, userAuthorization2.user, 
            status, useTestAccount, function (err, oauthUserStatus) {

                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserStatus);
            });
        }],

        assertItHasPopulatedGrantedAuth: ['createOauthUserStatus',
                                          function (cb, results) {
            
            var userAuthorization = results.createUserAuthorization;

            populateGrantedAuthorizations.call({
                eventName: 'remove'
            }, entityType).call(entity, function () {
                assert.ok(Type.is(entity._granted_authorizations, Array));

                assert.strictEqual(entity._granted_authorizations.length, 1);

                // Make sure returned authorization 
                // is the one which is bound to client
                // which have called the GET user API method
                assert.strictEqual(entity._granted_authorizations[0].id,
                                   userAuthorization.id);

                // Make sure client was populated
                assert.ok('update_notification_handler' 
                          in entity._granted_authorizations[0].client);

                cb();
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb();
    });
};

describe('models.middlewares.pre.validate.populateGrantedAuthorizations (Remove entity)', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            createUser(function (err, _user) {
                if (err) {
                    return done(err);
                }

                user = _user;

                done();
            });
        });
    });

    it('has populated `_granted_authorizations` '
       + 'field for removed email', function (done) {
        
        createEmail.call({
            user: user.id
        }, function (err, email) {
            if (err) {
                return done(err);
            } 

            assertItHasPopulated('emails', email, done);
        });
    });

    it('has populated `_granted_authorizations` '
       + 'field for removed phone number', function (done) {
        
        createPhoneNumber.call({
            user: user.id
        }, function (err, phoneNumber) {
            if (err) {
                return done(err);
            } 

            assertItHasPopulated('phone_numbers', phoneNumber, done);
        });
    });
    
    it('has populated `_granted_authorizations` '
       + 'field for removed address', function (done) {
        
        createAddress.call({
            user: user.id
        }, function (err, address) {
            if (err) {
                return done(err);
            } 

            assertItHasPopulated('addresses', address, done);
        });
    });
});