var assert = require('assert');
var mongoose = require('mongoose');

var async = require('async');

var ownEntity = require('../../../../models/methods/user/ownEntity');

var createUser = require('../../../../testUtils/db/createUser');
var createEmail = require('../../../../testUtils/db/createEmail');

describe('models.methods.user.ownEntity', function () {
    // Connect to database
    before(function (done) {
        require('../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                ownEntity.call(v, 'emails', mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string as field to seek into', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, '', [], 0.0, function () {}].forEach(function (v) {
                assert.throws(function () {
                    ownEntity.call(user, v, mongoose.Types.ObjectId());
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('throws an exception when passing non-object-ID as ID', function (done) {
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], '', 0.0].forEach(function (v) {
                assert.throws(function () {
                    ownEntity.call(user, 'emails', v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    // Added after a bug which triggered 
    // `Cannot read property 'map' of undefined` 
    // when passed user was populated user
    it('works with populated user', function (done) {
        var emailID = mongoose.Types.ObjectId();

        async.auto({
            createUser: function (cb) {
                createUser.call({
                    user: {
                        emails: [emailID],
                        password: 'foobar'
                    }
                }, cb);
            },

            createEmail: ['createUser', function (cb, results) {
                var user = results.createUser;

                createEmail.call({
                    user: user.id
                }, cb);
            }],

            populateEmail: ['createEmail', function (cb, results) {
                var email = results.createEmail;

                email.populate('user', cb);
            }]
        }, function (err, results) {
            var email = results && results.populateEmail;
            var user = email && email.user;

            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEntity.call(user, 'emails', emailID),
                true
            );

            assert.strictEqual(
                ownEntity.call(user, 'emails', mongoose.Types.ObjectId()),
                false
            );

            done();
        });
    });

    it('returns `false` when user doesn\'t own entity', function (done) {
        var emailID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                emails: [emailID],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEntity.call(user, 'emails', mongoose.Types.ObjectId()),
                false
            );

            // Make sure it also works with email ID as string
            assert.strictEqual(
                ownEntity.call(user, 'emails', mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns `true` when user own entity', function (done) {
        var emailID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                emails: [emailID],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEntity.call(user, 'emails', emailID),
                true
            );

            // Make sure it also works with email ID as string
            assert.strictEqual(
                ownEntity.call(user, 'emails', emailID.toString()),
                true
            );

            done();
        });
    });

    it('returns `false` when user doesn\'t own multiple path entity', function (done) {
        var clientID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                developer: {
                    clients: [clientID]
                },
                is_developer: true
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEntity.call(user, 'developer.clients', mongoose.Types.ObjectId()),
                false
            );

            // Make sure it also works with client ID as string
            assert.strictEqual(
                ownEntity.call(user, 'developer.clients', mongoose.Types.ObjectId().toString()),
                false
            );

            done();
        });
    });

    it('returns `true` when user own multiple path entity', function (done) {
        var clientID = mongoose.Types.ObjectId();

        createUser.call({
            user: {
                password: 'foobar',
                developer: {
                    clients: [clientID]
                },
                is_developer: true
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(
                ownEntity.call(user, 'developer.clients', clientID),
                true
            );

            // Make sure it also works with client ID as string
            assert.strictEqual(
                ownEntity.call(user, 'developer.clients', clientID.toString()),
                true
            );

            done();
        });
    });
});