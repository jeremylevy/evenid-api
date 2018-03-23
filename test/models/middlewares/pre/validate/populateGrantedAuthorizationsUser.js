var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var populateGrantedAuthorizations = require('../../../../../models/middlewares/pre/validate/populateGrantedAuthorizations');

var createUser = require('../../../../../testUtils/db/createUser');
var createUserAuthorization = require('../../../../../testUtils/db/createUserAuthorization');

describe('models.middlewares.pre.validate.populateGrantedAuthorizations (Update user)', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('populates `_granted_authorizations` field for user entity', function (done) {
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

            // And authorize one client
            createUserAuthorization: ['createUser', function (cb, results) {
                var user = results.createUser;

                createUserAuthorization.call({
                    user: user
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            assertItHasPopulatedGrantedAuth: ['createUserAuthorization', 
                                              function (cb, results) {
                
                var user = results.createUser;

                populateGrantedAuthorizations('users').call(user, function () {
                    assert.ok(Type.is(user._granted_authorizations, Array));

                    assert.strictEqual(user._granted_authorizations.length, 1);

                    // Make sure client was populated
                    assert.ok('update_notification_handler' 
                              in user._granted_authorizations[0].client);

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