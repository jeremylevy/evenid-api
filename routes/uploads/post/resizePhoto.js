var validator = require('validator');

var fs = require('fs');
var path = require('path');

var async = require('async');
var request = require('request');

var easyimg = require('easyimage');
var AWS = require('aws-sdk');

var config = require('../../../config');

var db = require('../../../models');

var resizePhoto = require('../../../libs/resizePhoto');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    app.post('/uploads/resize-photo', checkScope('app'), function (req, res, next) {
        var bucketKey = validator.trim(req.body.bucket_key);
        
        var originalPhotoURL = null;
        var uploadHash = null;
        
        var entity = null;
        var resizeAction = 'resize';

        var s3 = new AWS.S3({
            accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
            secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
            region: config.EVENID_AWS.S3.REGION,
            sslEnabled: true
        });

        if (!bucketKey.match(config.EVENID_AWS
                                   .S3
                                   .UPLOADS_BUCKET
                                   .AUTHORIZED_KEYS.join('|'))) {
            
            return next(new InvalidRequestError({
                bucket_key: 'Bucket key is invalid.'
            }));
        }

        originalPhotoURL = config.EVENID_AWS
                                     .CLOUDFRONT
                                     .URLS
                                     .UPLOADS
                            + '/'
                            + bucketKey;

        // users/profil-photos/{photo_hash}
        // clients/logos/{photo_hash}
        entity = bucketKey.split('/')[0];
        uploadHash = bucketKey.split('/').slice(-1);

        if (entity === 'users') {
            resizeAction = 'thumbnail';
        }

        async.auto({
            // Try to find if photo was 
            // already resized and put on S3
            findPhoto: function (cb) {
                db.models.Photo.findOne({
                    sid: uploadHash
                }, function (err, photo) {
                    if (err) {
                        return cb(err);
                    }

                    if (!photo) {
                        return cb(null);
                    }

                    cb(new AccessDeniedError());
                });
            },

            // Get the ORIGINAL photo on S3 if not found
            getPhoto: ['findPhoto', function (cb, results) {
                var pathToWrite = config.TMP_PATH + '/' + uploadHash;
                var photoExt = '';
                
                var stream = fs.createWriteStream(pathToWrite);
                var thereWasAnError = false;

                request.get(config.ENV === 'test'
                            // Given that we check for magic bytes
                            // make sur this image is set to png
                            ? 'http://dummyimage.com/200x400/000/fff.png' 
                            : originalPhotoURL, {
                                // Fix unauthorized cert error
                                // See https://github.com/nodejs/node-v0.x-archive/issues/8894
                                rejectUnauthorized: false
                            })
                        .on('response', function(response) {
                            var contentType = response.headers['content-type'];

                            // See below to learn why we need 
                            // to append `.ico` extension to photo files
                            if (['image/vnd.microsoft.icon', 
                                 'image-x-icon'].indexOf(contentType) !== -1) {
                                photoExt = 'ico';
                            }
                        })
                        .on('error', function (err) {
                            if (thereWasAnError) {
                                return;
                            }
                            
                            thereWasAnError = true;

                            cb(err);
                        })
                        .pipe(stream);

                stream.on('error', function (err) {
                    if (thereWasAnError) {
                        return;
                    }

                    thereWasAnError = true;

                    cb(err);
                });

                stream.on('finish', function (data) {
                    if (thereWasAnError) {
                        return;
                    }

                    // The ICO format does not have a magic string 
                    // to help identify it like JPEG or PNG does. 
                    // Instead you must hint to ImageMagick 
                    // the format the photo is by appending photo extension.
                    if (photoExt) {
                        fs.rename(pathToWrite, pathToWrite + '.' + photoExt, function (err) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, {
                                pathToWrite: pathToWrite,
                                photoExt: '.' + photoExt
                            });
                        });

                        return;
                    }

                    cb(null, {
                        pathToWrite: pathToWrite,
                        photoExt: ''
                    });
                });
            }],

            // Resize downloaded photo to asked size
            resizePhoto: ['getPhoto', function (cb, results) {
                var getPhotoResp = results.getPhoto;
                var resizeFns = [];

                config.EVENID_PHOTOS
                      .AVAILABLE_SIZES
                      .forEach(function (size) {

                    resizeFns.push(function (cb) {
                        resizePhoto(bucketKey, resizeAction, size, getPhotoResp, cb);
                    });
                });

                async.parallel(resizeFns, function (err, results) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            insertPhotoInDB: ['resizePhoto', function (cb, results) {
                db.models.Photo.create({
                    sid: uploadHash
                }, function (err, photo) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, photo);
                });
            }],

            removeDownloadedPhoto: ['insertPhotoInDB', function (cb, results) {
                var getPhotoResp = results.getPhoto;

                var photoExt = getPhotoResp.photoExt;
                var photoPath = getPhotoResp.pathToWrite + photoExt;

                // Delete photo downloaded from AWS S3
                fs.unlink(photoPath, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }]
        }, function (err, results) {
            if (err) {
                return next(err);
            }

            res.send({
                original_photo_url: originalPhotoURL
            });
        });
    });
};