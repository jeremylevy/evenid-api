var assert = require('assert');
var Type = require('type-of-is');

var crypto = require('crypto');
var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../../config');

var getProfilPhoto = require('../../../../../models/properties/getters/user/profilPhoto');

var createEmail = require('../../../../../testUtils/db/createEmail'); 
var createUser = require('../../../../../testUtils/db/createUser');

describe('models.properties.getters.user.profilPhoto', function () {
    // Connect to database
    before(function (done) {
        require('../../../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('throws an exception when passing invalid context', function () {
        [null, undefined, {}, [], '', 0.0, function () {}].forEach(function (v) {
            assert.throws(function () {
                getProfilPhoto.call(v, mongoose.Types.ObjectId());
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-upload-hash '
       + 'non-false value as profil photo hash', function (done) {
        
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [{}, [], 'foo', 18.0].forEach(function (v) {
                assert.throws(function () {
                    getProfilPhoto.call(user, v);
                }, assert.AssertionError);
            });

            done();
        });
    });

    it('returns `undefined` when profil photo hash was not '
       + 'passed and user\'s emails were not populated', function (done) {
        
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, false, ''].forEach(function (v) {
                assert.ok(Type.is(getProfilPhoto.call(user, v), undefined));
            });

            done();
        });
    });

    it('returns user\'s gravatar when profil photo hash was not '
       + 'passed and user\'s emails were populated', function (done) {
        
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

            assert.ok(gravatarReg.test(getProfilPhoto.call(user)));

            done();
        });
    });

    it('returns full URL when profil photo hash was passed', function (done) {
        var profilPhotohash = crypto.createHash('sha1')
                                    .update(mongoose.Types.ObjectId().toString())
                                    .digest('hex');

        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            assert.ok(getProfilPhoto.call(user, profilPhotohash) 
                      === config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                        + '/users/profil-photos/' 
                        + profilPhotohash);

            done();
        });
    });
});