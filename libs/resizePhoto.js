var assert = require('assert');
var Type = require('type-of-is');

var fs = require('fs');
var path = require('path')

var async = require('async');
var regexQuote = require('regexp-quote');

var easyimg = require('easyimage');
var AWS = require('aws-sdk');

var exec = require('child_process').exec;

var config = require('../config');

module.exports = function (bucketKey, resizeAction, size, getPhotoResp, cb) {
    assert.ok(Type.is(bucketKey, String)
                && bucketKey.match(config.EVENID_AWS
                                    .S3
                                    .UPLOADS_BUCKET
                                    .AUTHORIZED_KEYS.join('|')),
              'argument `bucketKey` is invalid');

    assert.ok(config.EVENID_PHOTOS
                    .ALLOWED_RESIZE_ACTIONS
                    .indexOf(resizeAction) !== -1,
              'argument `resizeAction` is invalid');

    assert.ok(config.EVENID_PHOTOS
                    .AVAILABLE_SIZES
                    .indexOf(size) !== -1,
              'argument `size` is invalid');

    assert.ok(Type.is(getPhotoResp, Object)
              && Type.is(getPhotoResp.pathToWrite, String)
              && getPhotoResp.pathToWrite.length
              && (getPhotoResp.photoExt === '' 
                  || Type.is(getPhotoResp.photoExt, String)
                    && getPhotoResp.photoExt.indexOf('.') === 0),
              'argument `getPhotoResp` is invalid');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    var s3 = new AWS.S3({
        accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
        secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
        region: config.EVENID_AWS.S3.REGION,
        sslEnabled: true
    });

    if (path.extname(getPhotoResp.pathToWrite)
        && getPhotoResp.photoExt) {

        getPhotoResp.pathToWrite = getPhotoResp.pathToWrite.replace(
            new RegExp(regexQuote(getPhotoResp.photoExt) + '$'),
            ''
        );
    }

    async.auto({
        // Resize downloaded photo to asked size
        resizePhoto: function (cb) {
            var photoExt = getPhotoResp.photoExt;
            var photoPath = getPhotoResp.pathToWrite + photoExt;

            var resizedPhotoPath = photoPath + size + photoExt;
            var actionData = {
                src: photoPath,
                dst: resizedPhotoPath,
                width: size,
                height: size,
                // Shrink an image only 
                // if its dimension(s) are larger 
                // than the corresponding width 
                // and/or height arguments
                largeronly: true
            };

            var successCallback = function (resizedPhotoPath, cb) {
                return function (photo) {
                    cb(null, {
                        path: resizedPhotoPath,
                        type: photo.type
                    });
                };
            };

            if (resizeAction === 'thumbnail') {
                // Node canvas doesn't support ICO files
                if (photoExt !== '.ico') {
                    exec('node $(npm bin)/smartcrop --width ' + size 
                         + ' --height ' + size 
                         + ' --quality 100 ' 
                         + photoPath 
                         + ' ' 
                         + resizedPhotoPath, function (err, stdout, stderr) {
                        
                        if (err) {
                            return cb(err);
                        }

                        easyimg.info(photoPath)
                               .then(successCallback(resizedPhotoPath, cb), function (err) {
                                    return cb(err);
                                });
                    });

                    return;
                }

                easyimg.thumbnail(actionData)
                       .then(successCallback(resizedPhotoPath, cb), function (err) {
                            return cb(err);
                        });

                return;
            }

            if (resizeAction === 'resize') {
                easyimg.resize(actionData)
                       .then(successCallback(resizedPhotoPath, cb), function (err) {
                    return cb(err);
                });

                return;
            }
        },

        putOnS3: ['resizePhoto', function (cb, results) {
            var resizedPhoto = results.resizePhoto;

            var resizedPhotoPath = resizedPhoto.path;
            var resizedPhotoType = resizedPhoto.type;

            var params = {
                Bucket: config.EVENID_AWS.S3.BUCKETS.UPLOADS,
                Key: bucketKey + '/' + size,
                Body: null,
                CacheControl: 'max-age=' + config.EVENID_PHOTOS
                                                 .PROPERTIES
                                                 .CACHE_CONTROL_MAX_AGE,
                ContentType: resizedPhotoType 
                                ? 'image/' + resizedPhotoType.toLowerCase() 
                                // Use a default content type
                                : 'image/png',
                ACL: config.EVENID_PHOTOS
                           .PROPERTIES
                           .ACL
            };

            fs.readFile(resizedPhotoPath, function (err, data) {
                if (err) {
                    return cb(err);
                }

                params.Body = data;

                s3.putObject(params, function (err, data) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, data);
                });
            });
        }],

        removeTmpPhotos: ['putOnS3', function (cb, results) {
            var resizedPhoto = results.resizePhoto;
            var resizedPhotoPath = resizedPhoto.path;

            // Delete resized photo, 
            // after it was 
            // successfully saved on AWS S3
            fs.unlink(resizedPhotoPath, function (err) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb();
    });
};