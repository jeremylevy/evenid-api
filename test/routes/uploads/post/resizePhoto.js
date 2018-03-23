var crypto = require('crypto');
var fs = require('fs');

var assert = require('assert');

var request = require('supertest');
var mongoose = require('mongoose');

var nock = require('nock');

var async = require('async');
var requestExt = require('request');

var gm = require('gm').subClass({imageMagick: true});

var config = require('../../../../config');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var createPhoto = require('../../../../testUtils/db/createPhoto');
var findPhotos = require('../../../../testUtils/db/findPhotos');

var resizePhotoMock = require('../../../../testUtils/mocks/routes/uploads/post/resizePhoto');

var testIcoImgSize = 16;

var getImageSize = function (image, cb) {
    gm(image).size(cb);
};

var validUploadHash = function () {
    return crypto.createHash('sha1')
                 .update(mongoose.Types.ObjectId().toString())
                 .digest('hex')
};

var testResizePhotoFor = function (entity, imgType, done) {
    var uploadHash = validUploadHash();

    var bucketKey = entity === 'users' 
        ? 'users/profil-photos/' + uploadHash 
        : 'clients/logos/' + uploadHash;

    var originalPhotoURL = config.EVENID_AWS
                                 .CLOUDFRONT
                                 .URLS
                                 .UPLOADS 
                            + '/' + bucketKey;

    var checkPhotoFns = [];

    makeARequest(200, {
        bucket_key: bucketKey
    }, '{"original_photo_url":"' + originalPhotoURL + '"}', function (err, resp) {
        if (err) {
            return done(err);
        }

        // Make sure all tmp files were removed
        assert.ok(!fs.existsSync(config.TMP_PATH + '/' + uploadHash));

        // Make sure all tmp files were removed
        config.EVENID_PHOTOS.AVAILABLE_SIZES.forEach(function (size) {
            assert.ok(!fs.existsSync(config.TMP_PATH + '/' + uploadHash + size));
        });

        // Make sure all sizes were set to S3
        config.EVENID_PHOTOS.AVAILABLE_SIZES.forEach(function (size) {
            checkPhotoFns.push(function (cb) {
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
                            if (entity === 'users') {
                                assert.strictEqual(imageSize.width, size);
                                assert.strictEqual(imageSize.height, size);
                            } else {
                                // Test photo is W200 x H400
                                assert.strictEqual(imageSize.width, Math.ceil(size / 2));
                                assert.strictEqual(imageSize.height, size);
                            }
                        } else {
                            assert.strictEqual(imageSize.width, Math.min(size, testIcoImgSize));
                            assert.strictEqual(imageSize.height, Math.min(size, testIcoImgSize));

                            fs.unlinkSync(icoFilePath);
                        }

                        cb();
                    });
                });
            });
        });

        async.parallel(checkPhotoFns, function (err) {
            if (err) {
                return done(err);
            }

            // Make sure photo upload hash
            // was inserted in DB
            findPhotos([uploadHash], function (err, photos) {
                assert.ok(!err);

                assert.strictEqual(photos.length, 1);

                done();
            });
        });
    });
};

var makeARequest = null;
var app = null;

describe('POST /uploads/resize-photo', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .post('/uploads/resize-photo')
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
                        .set('Authorization', authHeader)
                        .send(data)
                        .expect('Content-Type', 'application/json; charset=utf-8')
                        .expect('Cache-Control', 'no-store')
                        .expect('Pragma', 'no-cache')
                        .expect(body)
                        .expect(statusCode, function (err, resp) {
                            if (err) {
                                return done(err);
                            }

                            assert.doesNotThrow(function () {
                                JSON.parse(resp.text);
                            });

                            done(null, resp);
                        });
                }.bind(this);

                if (this.accessToken) {
                    return cb(null, this.accessToken);
                }

                getAppAccessToken(function (err, accessToken, user) {
                    cb(err, accessToken);
                });
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        makeARequest.call({
            accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
        }, 400, {}, /invalid_token/, done);
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 400, {}, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to create client', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid bucket key was passed', function (done) {

        makeARequest(400, {
            bucket_key: 'bar'
        }, /invalid_request/, done);
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when photo was already resized', function (done) {

        createPhoto(function (err, photo) {
            if (err) {
                return done(err);
            }

            makeARequest(403, {
                bucket_key: 'users/profil-photos/' + photo.sid
            }, /access_denied/, done);
        });
    });

    it('responds with HTTP code 200 and original photo url '
       + 'for user profil photos', function (done) {

        testResizePhotoFor('users', 'png', done);
    });

    it('responds with HTTP code 200 and original photo url '
       + 'for client logos', function (done) {

        testResizePhotoFor('clients', 'png', done);
    });

    it('works with ico files and doesn\'t resize smaller images '
       + 'for user profil photos', function (done) {

        var mockScopes = resizePhotoMock();

        testResizePhotoFor('users', 'ico', function (err) {
            if (err) {
                return done(err);
            }

            mockScopes.forEach(function (mockScope) {
                assert.ok(mockScope.isDone());
            });

            done();
        });
    });

    it('works with ico files and doesn\'t resize smaller images '
       + 'for client logos', function (done) {

        var mockScopes = resizePhotoMock();

        testResizePhotoFor('clients', 'ico', function (err) {
            if (err) {
                return done(err);
            }

            mockScopes.forEach(function (mockScope) {
                assert.ok(mockScope.isDone());
            });

            done();
        });
    });
});