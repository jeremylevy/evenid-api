var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var getEmail = require('../../../../../../models/properties/getters/user/virtuals/email');

var createEmail = require('../../../../../../testUtils/db/createEmail');
var createUser = require('../../../../../../testUtils/db/createUser');

describe('models.properties.getters.user.virtuals.email', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                getEmail.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns `undefined` when user doesn\'t have emails', function (done) {
        createUser.call({
            user: {
                emails: [],
                password: 'foobar'
            }
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(getEmail.call(user), undefined);

            done();
        });
    });

    it('returns `undefined` when user\'s emails '
       + 'were not populated', function (done) {

        async.auto({
            createEmail: function (cb) {
                createEmail.call({
                    isMainAddress: true
                }, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createUser: ['createEmail', function (cb, results) {
                var email = results.createEmail;

                createUser.call({
                    user: {
                        emails: [email.id],
                        password: 'foobar'
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }]
        }, function (err, results) {
            var user = results.createUser;

            if (err) {
                return done(err);
            }

            assert.strictEqual(getEmail.call(user), undefined);

            done();
        });
    });

    it('returns user\'s main email address '
       + 'when user\'s emails were populated', function (done) {
        
        async.auto({
            createMainEmail: function (cb) {
                createEmail.call({
                    isMainAddress: true
                }, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createSecondEmail: function (cb) {
                createEmail.call({
                    isMainAddress: false
                }, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, email);
                });
            },

            createUser: ['createMainEmail', 'createSecondEmail', function (cb, results) {
                var email = results.createMainEmail;
                var secondEmail = results.createSecondEmail;

                createUser.call({
                    user: {
                        emails: [email.id, secondEmail.id],
                        password: 'foobar'
                    }
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            populateUserEmails: ['createUser', function (cb, results) {
                var user = results.createUser;
                
                user.populate('emails', function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }]
        }, function (err, results) {
            var user = results.createUser;
            var email = results.createMainEmail;

            if (err) {
                return done(err);
            }

            assert.strictEqual(getEmail.call(user), email.address);

            done();
        });
    });
});