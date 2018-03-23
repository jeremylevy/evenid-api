var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');
var async = require('async');

var findUserAuthorizations = require('../../../models/actions/findUserAuthorizations');

var compareArray = require('../../../testUtils/lib/compareArray');

var createUserAuthorization = require('../../../testUtils/db/createUserAuthorization');

var compareUserAuthorizations = function (userAuthorizationRef, userAuthorizations) {
    var userAuthorization = userAuthorizations[0];

    // If client was not populated
    if (!userAuthorization.client.id) {
        assert.strictEqual(userAuthorization.client.toString(), 
                           userAuthorizationRef.client.toString());
    }

    assert.strictEqual(userAuthorization.user.toString(), 
                       userAuthorizationRef.user.toString());

    /* `toObject()`: Returns a native js Array. */
    
    assert.ok(compareArray(userAuthorization.scope.toObject(), 
                        userAuthorizationRef.scope.toObject()));

    assert.ok(compareArray(userAuthorization.entities.emails.toObject(), 
                        userAuthorizationRef.entities.emails.toObject()));

    assert.ok(compareArray(userAuthorization.entities.phone_numbers.toObject(),
                        userAuthorizationRef.entities.phone_numbers.toObject()));
    
    assert.ok(compareArray(userAuthorization.entities.addresses.toObject(),
                        userAuthorizationRef.entities.addresses.toObject()));
};

describe('models.actions.findUserAuthorizations', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing non-false invalid value as entity', function () {
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizations(v, null, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-false invalid value as entity ID', function () {
        [{}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizations(null, v, mongoose.Types.ObjectId(), function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-ObjectID as userID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizations(null, null, v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                findUserAuthorizations(null, null, mongoose.Types.ObjectId(), v);
            }, assert.AssertionError);
        });
    });

    it('returns an empty array when user doesn\'t exist', function (done) {
        findUserAuthorizations(null, null, mongoose.Types.ObjectId(), function (err, userAuthorizations) {
            if (err) {
                return done(err);
            }

            assert.ok(compareArray(userAuthorizations, []));

            done();
        });
    });

    it('returns user authorizations without populated client '
       + 'when empty context, user exists and has authorized clients', function (done) {
        
        createUserAuthorization(function (err, userAuthorizationRef) {
            if (err) {
                return done(err);
            }

            findUserAuthorizations(null, null, userAuthorizationRef.user, function (err, userAuthorizations) {
                if (err) {
                    return done(err);
                }

                compareUserAuthorizations(userAuthorizationRef, userAuthorizations);

                done();
            });
        });
    });
    
    it('returns user authorizations without populated client '
       + 'when empty context, entity was passed, user exists and has authorized clients', function (done) {

        async.auto({
            createUserAuthorization: function (cb) {
                createUserAuthorization.call({
                    scope: 'emails'
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                })
            },

            createUserAuthorization2: ['createUserAuthorization', function (cb, results) {
                var userAuthorization = results.createUserAuthorization;

                createUserAuthorization.call({
                    user: {
                        _id: userAuthorization.user
                    },
                    scope: ['phone_numbers']
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                })
            }]
        }, function (err, results) {
            var userAuthorizationRef = results && results.createUserAuthorization;

            if (err) {
                return done(err);
            }

            findUserAuthorizations('emails', null, userAuthorizationRef.user, function (err, userAuthorizations) {
                if (err) {
                    return done(err);
                }

                compareUserAuthorizations(userAuthorizationRef, userAuthorizations);

                /* Make sure only authorization which contains `emails` in scope
                   has been returned */
                
                assert.strictEqual(userAuthorizations.length, 1);
                assert.ok(userAuthorizations[0].scope.indexOf('emails') !== -1);

                done();
            });
        });
    });

    it('returns user authorizations without populated client '
       + 'when empty context, entity and entity ID was passed, '
       + 'user exists and has authorized clients', function (done) {
        
        async.auto({
            createUserAuthorization: function (cb) {
                createUserAuthorization.call({
                    scope: 'emails'
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                })
            },

            createUserAuthorization2: ['createUserAuthorization', function (cb, results) {
                var userAuthorization = results.createUserAuthorization;

                createUserAuthorization.call({
                    user: {
                        _id: userAuthorization.user
                    },
                    scope: ['emails']
                }, function (err, userAuthorization) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                })
            }]
        }, function (err, results) {
            var userAuthorizationRef = results && results.createUserAuthorization;

            if (err) {
                return done(err);
            }

            findUserAuthorizations('emails', userAuthorizationRef.entities.emails[0], 
                                   userAuthorizationRef.user, function (err, userAuthorizations) {
                if (err) {
                    return done(err);
                }

                compareUserAuthorizations(userAuthorizationRef, userAuthorizations);

                /* Make sure only authorization which contains this email ID
                   has been returned */

                assert.strictEqual(userAuthorizations.length, 1);
                assert.strictEqual(userAuthorizations[0].entities.emails.length, 1);
                assert.strictEqual(userAuthorizations[0].entities.emails[0].toString(),
                                   userAuthorizationRef.entities.emails[0].toString());

                done();
            });
        });
    });
    
    it('returns user authorizations with populated client '
       + 'when `usedToDiplayInViews` context, user exists and has authorized clients', function (done) {
        
        createUserAuthorization(function (err, userAuthorizationRef) {
            if (err) {
                return done(err);
            }

            findUserAuthorizations.call({
                usedTo: 'displayInViews'
            }, null, null, userAuthorizationRef.user, function (err, userAuthorizations) {
                if (err) {
                    return done(err);
                }

                compareUserAuthorizations(userAuthorizationRef, userAuthorizations);

                // Make sure client was populated
                assert.ok(Type.is(userAuthorizations[0].client.name, String));

                done();
            });
        });
    });
    
    it('returns user authorizations with populated client '
       + 'when `notifyClients` context, user exists and has authorized clients', function (done) {
        
        createUserAuthorization(function (err, userAuthorizationRef) {
            if (err) {
                return done(err);
            }

            findUserAuthorizations.call({
                usedTo: 'notifyClients'
            }, null, null, userAuthorizationRef.user, function (err, userAuthorizations) {
                if (err) {
                    return done(err);
                }

                compareUserAuthorizations(userAuthorizationRef, userAuthorizations);

                // Make sure client was populated
                assert.ok('update_notification_handler' in userAuthorizations[0].client);

                done();
            });
        });
    });
});