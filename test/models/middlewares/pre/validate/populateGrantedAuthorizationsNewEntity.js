var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var db = require('../../../../../models');

var populateGrantedAuthorizations = require('../../../../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var createUser = require('../../../../../testUtils/db/createUser');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

var assertItHasPopulated = function (entityType, cb) {
    async.auto({
        // We create the user
        createUser: function (cb) {
            createUser(function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        },

        // One client wants entity type
        createUserAuthorization: ['createUser', function (cb, results) {
            var user = results.createUser;

            createUserAuthorization.call({
                user: user,
                scope: [entityType],
                entities: {
                    emails: [],
                    phone_numbers: [],
                    addresses: []
                }
            }, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            });
        }],

        // Create another authorization to ensure that
        // granted authorizations contains 
        // only authorizations for clients which 
        // ask for entity type
        createUserAuthorization2: ['createUser', function (cb, results) {
            var user = results.createUser;

            // Only authorizations for new 
            // addresses are populated
            if (entityType !== 'addresses') {
                return cb(null);
            }

            createUserAuthorization.call({
                user: user,
                // Different from addresses
                scope: ['emails'],
                entities: {
                    emails: [],
                    phone_numbers: [],
                    addresses: []
                }
            }, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            });
        }],

        assertItHasPopulatedGrantedAuth: ['createUserAuthorization', 
                                          'createUserAuthorization2',
                                          function (cb, results) {
            
            var user = results.createUser;
            var userAuthorization = results.createUserAuthorization;

            var entity = new db.models.Address();

            if (entityType === 'phone_numbers') {
                entity = new db.models.PhoneNumber();
            } else if (entityType === 'emails') {
                entity = new db.models.Email();
            }

            entity.user = user.id;

            populateGrantedAuthorizations(entityType).call(entity, function () {
                assert.ok(Type.is(entity._granted_authorizations, Array));

                // Only authorizations for new 
                // addresses are populated
                if (entityType === 'addresses') {
                    assert.strictEqual(entity._granted_authorizations.length, 1);

                    // Make sure returned authorization 
                    // is the one which have addresses scope
                    assert.strictEqual(entity._granted_authorizations[0].id,
                                       userAuthorization.id);

                    // Make sure client was populated
                    assert.ok('update_notification_handler' 
                              in entity._granted_authorizations[0].client);
                } else {
                    assert.strictEqual(entity._granted_authorizations.length, 0);
                }

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

describe('models.middlewares.pre.validate.populateGrantedAuthorizations (New entity)', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('does not populate `_granted_authorizations` '
       + 'field for new emails', function (done) {
        
        assertItHasPopulated('emails', done);
    });

    it('does not populate `_granted_authorizations` '
       + 'field for new phone numbers', function (done) {
        
        assertItHasPopulated('phone_numbers', done);
    });
    
    it('populates `_granted_authorizations` '
       + 'field for new addresses', function (done) {
        
        assertItHasPopulated('addresses', done);
    });
});