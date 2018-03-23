var crypto = require('crypto');
var fs = require('fs');

var assert = require('assert');
var mongoose = require('mongoose');

var requestExt = require('request');

var gm = require('gm').subClass({imageMagick: true});

var config = require('../../config');

var resizePhoto = require('../../libs/resizePhoto');

var getImageSize = function (image, cb) {
    gm(image).size(cb);
};

var validUploadHash = function () {
    return crypto.createHash('sha1')
                 .update(mongoose.Types.ObjectId().toString())
                 .digest('hex');
};

var validBucketKey = 'users/profil-photos/' + validUploadHash();
var validResizeAction = 'resize';

var validSize = 200;
var validGetPhotoResp = {
    pathToWrite: '/path/to/write',
    photoExt: ''
};

var defaultImagePath = __dirname + '/../../testUtils/mocks/libs/resizePhoto/default.png';
var defaultIcoImagePath = __dirname + '/../../testUtils/mocks/libs/resizePhoto/default.ico';

var testIcoImgSize = 16;

var assertItHasResized = function (originalPhotoURL, size, imgType, resizeAction, cb) {
    var uploadHash = originalPhotoURL.split('/').slice(-1);

    // Make sure all tmp files were removed
    assert.ok(!fs.existsSync(defaultImagePath + size));

    requestExt.get(originalPhotoURL + '/' + size, {
        // Fix unauthorized cert error
        // See https://github.com/nodejs/node-v0.x-archive/issues/8894
        rejectUnauthorized: false,
        // Keep the body as buffer
        encoding: null
    }, function (error, response, body) {
        var magicNumberInBody = !error && body.toString('hex', 0, 4);
        // The ICO format does not have a magic string 
        // to help identify it like JPEG or PNG does. 
        // Instead you must hint to ImageMagick 
        // the format the photo is by appending photo extension.
        var icoFilePath = config.TMP_PATH + '/' + uploadHash + size + '.ico';

        assert.ok(!error && response.statusCode === 200);

        // PNG
        if (imgType === 'png') {
            assert.strictEqual(magicNumberInBody, '89504e47');
        } else { // ICO
            assert.strictEqual(magicNumberInBody, '00000100');

            fs.writeFileSync(icoFilePath, body);
        }

        getImageSize(imgType === 'png' 
            ? body 
            : icoFilePath, 
        function (err, imageSize) {
            
            if (err) {
                return cb(err);
            }

            if (imgType === 'png') {
                if (resizeAction === 'thumbnail') {
                    assert.strictEqual(imageSize.width, size);
                    assert.strictEqual(imageSize.height, size);
                } else {
                    // Test photo is W200 x H400
                    assert.strictEqual(imageSize.width, Math.ceil(size / 2));
                    assert.strictEqual(imageSize.height, size);
                }
            } else {
                assert.strictEqual(imageSize.width, testIcoImgSize);
                assert.strictEqual(imageSize.height, testIcoImgSize);

                fs.unlinkSync(icoFilePath);
            }

            cb();
        });
    });
};

describe('libs.resizePhoto', function () {
    it('throws an exception when passing invalid bucket key', function () {
        [null, undefined, {}, [], 9, '', function () {}].forEach(function (v) {
            assert.throws(function () {
                resizePhoto(v, validResizeAction, 
                            validSize, validGetPhotoResp,
                            function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid resize action', function () {        
        [null, undefined, {}, 9, [], '', function () {}].forEach(function (v) {
            assert.throws(function () {
                resizePhoto(validBucketKey, v, 
                            validSize, validGetPhotoResp,
                            function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid size', function () {        
        [null, undefined, {}, 9, [], '', function () {}].forEach(function (v) {
            assert.throws(function () {
                resizePhoto(validBucketKey, validResizeAction, 
                            v, validGetPhotoResp,
                            function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid `getPhotoResp`', function () {        
        [null, undefined, {}, 9, [], '', function () {}].forEach(function (v) {
            assert.throws(function () {
                resizePhoto(validBucketKey, validResizeAction, 
                            validSize, v,
                            function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid callback', function () {        
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                resizePhoto(validBucketKey, validResizeAction, 
                            validSize, validGetPhotoResp,
                            v);
            }, assert.AssertionError);
        });
    });

    it('works for thumbnail resize action', function (done) {
        var bucketKey = 'users/profil-photos/' + validUploadHash();
        var size = 200;

        var resizeAction = 'thumbnail';

        var originalPhotoURL = config.EVENID_AWS
                                 .CLOUDFRONT
                                 .URLS
                                 .UPLOADS 
                                + '/' + bucketKey;

        resizePhoto(bucketKey, resizeAction, size, {
            pathToWrite: defaultImagePath,
            photoExt: ''
        }, function (err) {
            if (err) {
                return done(err);
            }

            assertItHasResized(originalPhotoURL, size, 'png', resizeAction, done);
        });
    });

    it('works for resize action', function (done) {
        var bucketKey = 'users/profil-photos/' + validUploadHash();
        var size = 200;

        var resizeAction = 'resize';

        var originalPhotoURL = config.EVENID_AWS
                                 .CLOUDFRONT
                                 .URLS
                                 .UPLOADS 
                                + '/' + bucketKey;

        resizePhoto(bucketKey, resizeAction, size, {
            pathToWrite: defaultImagePath,
            photoExt: ''
        }, function (err) {
            if (err) {
                return done(err);
            }

            assertItHasResized(originalPhotoURL, size, 'png', resizeAction, done);
        });
    });

    it('works for `ico` files with extension and smaller image', function (done) {
        var bucketKey = 'users/profil-photos/' + validUploadHash();
        var size = 200;

        var resizeAction = 'resize';

        var originalPhotoURL = config.EVENID_AWS
                                 .CLOUDFRONT
                                 .URLS
                                 .UPLOADS 
                                + '/' + bucketKey;

        resizePhoto(bucketKey, resizeAction, size, {
            pathToWrite: defaultIcoImagePath,
            photoExt: '.ico'
        }, function (err) {
            if (err) {
                return done(err);
            }

            assertItHasResized(originalPhotoURL, size, 'ico', resizeAction, done);
        });
    });
});