var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var setProfilPhoto = require('../../../../../models/properties/setters/user/profilPhoto');

var createUser = require('../../../../../testUtils/db/createUser');

describe('models.properties.setters.user.profilPhoto', function () {
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
        [null, undefined, {}, [], 
         '', 0.0, function () {}].forEach(function (v) {
            
            assert.throws(function () {
                setProfilPhoto.call(v);
            }, assert.AssertionError);
        });
    });

    it('returns passed value when '
       + 'passing invalid URL', function (done) {
        
        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            [null, undefined, {}, [], 
             '', 0.0, function () {}].forEach(function (v) {
                
                assert.strictEqual(setProfilPhoto.call(user, v), v);
            });

            done();
        });
    });

    it('returns profil photo hash when passing '
       + 'valid profil photo URL', function (done) {
        
        var userID = mongoose.Types.ObjectId().toString();
        var profilPhotoHash = 'e36dfeef8d73527fe1765789a40ab4c68b76e43e';
        
        var profilPhotoURL = 'http://foo.com/user/' + userID 
                           + '/profil-photos/' + profilPhotoHash;

        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(setProfilPhoto.call(user, profilPhotoURL),
                               profilPhotoHash);

            done();
        });
    });

    it('returns profil photo ID when passing '
       + 'valid profil photo URL with size', function (done) {
        
        var userID = mongoose.Types.ObjectId().toString();
        var profilPhotoHash = 'e36dfeef8d73527fe1765789a40ab4c68b76e43e';
        
        var profilPhotoURL = 'http://foo.com/user/' + userID 
                           + '/profil-photos/' + profilPhotoHash
                           + '/25';

        createUser(function (err, user) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(setProfilPhoto.call(user, profilPhotoURL),
                               profilPhotoHash);

            done();
        });
    });
});