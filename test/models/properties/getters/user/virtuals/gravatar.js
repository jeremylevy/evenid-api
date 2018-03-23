var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');

var config = require('../../../../../../config');

var getGravatar = require('../../../../../../models/properties/getters/user/virtuals/gravatar');

var createEmail = require('../../../../../../testUtils/db/createEmail');
var createUser = require('../../../../../../testUtils/db/createUser');

describe('models.properties.getters.user.virtuals.gravatar', function () {
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
                getGravatar.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns `undefined` when user\'s emails were not populated', function (done) {
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

            assert.strictEqual(getGravatar.call(user), undefined);

            done();
        });
    });

    it('returns user\'s gravatar '
       + 'when user\'s emails were populated', function (done) {
        
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
            var gravatarReg = new RegExp('^' + config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                                             + '/users/profil-photos/default'
                                       + '$');
            
            if (err) {
                return done(err);
            }

            assert.ok(gravatarReg.test(getGravatar.call(user)));

            done();
        });
    });
});