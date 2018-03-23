var assert = require('assert');

var crypto = require('crypto');
var mongoose = require('mongoose');

var db = require('../../models');

var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');

var Photo = db.models.Photo;

var validUploadHash = function () {
    return crypto.createHash('sha1')
                 .update(mongoose.Types.ObjectId().toString())
                 .digest('hex');
};

var validPhoto = function (photo) {
    photo = photo || new Photo();

    photo.sid = validUploadHash();

    return photo;
};

var requiredFields = ['sid'];

describe('models.Photo', function () {
    // Connect to database
    before(function (done) {
        require('../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('validates that required fields are set', function (done) {
        var photo = new Photo();

        requiredFields.forEach(function (field) {
            photo[field] = null;
        });

        photo.validate(function (err) {
            /* Make sure model throws error 
               when required fields are not set */
            
            requiredFields.forEach(function (field) {
                assert.strictEqual(err.errors[field].name, 'ValidatorError');
            });

            /* Make sure model validation pass when all required
               fields are set */
            
            validPhoto(photo).validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });


    it('validates that `sid` is a valid upload hash', function (done) {
        var photo = validPhoto();

        photo.sid = 'bar';

        photo.validate(function (err) {
            assert.strictEqual(err.errors.sid.name, 'ValidatorError');

            /* Make sure model validation 
               pass when sizes field is valid */

            photo.sid = validUploadHash();

            photo.validate(function (err) {
                assert.ok(!err);

                done();
            });
        });
    });

    it('validates that `sid` is unique', function (done) {
        var photo = validPhoto();
        var usedSID = photo.sid;

        photo.save(function (err) {
            if (err) {
                return done(err);
            }

            photo = validPhoto();

            photo.sid = usedSID;

            photo.save(function (err) {
                assert.ok(isUniqueIndexError(err));
                
                done();
            });
        });
    });
});