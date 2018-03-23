var assert = require('assert');
var request = require('supertest');

var Type = require('type-of-is');
var moment = require('moment');

var config = require('../../../../config');

var AWSS3 = require('../../../../libs/classes/AWSS3');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

var awsS3 = new AWSS3(config.EVENID_AWS.S3.REGION, 
                      config.EVENID_AWS.ACCESS_KEY_SECRET);

// Positive lookahead assertion
var uploadPolicyReg = new RegExp('(?=.*params)(?=.*formAction)');

var successActionRedirect = 'http://foo.fr';

var isValidUploadPolicy = function (entity) {
    return function (resp) {
        var body = resp.body;
        var params = body.params;

        var decodedPolicy = JSON.parse(new Buffer(params.policy, 'base64').toString('utf-8'));

        // Given that we check for entire object
        // we need to use the same date to
        // not be fooled if test takes more time 
        // to run.
        // 20150918T0000000000Z -> 20150918
        var currentDate = moment.utc(params['x-amz-date'].split('T')[0], 'YYYYMMDD');
        var currentDateFormated = currentDate.format('YYYYMMDD');
        // AWS doesn't want separators
        var currentDateISOFormated = currentDate.toISOString()
                                                .replace(/-|:|\./g, '');

        var acl = config.EVENID_PHOTOS
                        .PROPERTIES
                        .ACL;

        // Same than above, reuse date.
        var expiresAt = moment.utc(decodedPolicy.expiration);

        var maxAge = 'max-age=' + config.EVENID_PHOTOS
                                        .PROPERTIES
                                        .CACHE_CONTROL_MAX_AGE;
        
        var maxContentLength = entity === 'user' 
            ? config.EVENID_PHOTOS
                    .MAX_FILE_SIZES
                    .USER_PROFIL_PHOTOS 
            : config.EVENID_PHOTOS
                    .MAX_FILE_SIZES
                    .CLIENT_LOGOS;

        var key = (entity === 'user' 
                   ? 'users/profil-photos/' 
                   : 'clients/logos/')
                // Get last "slash-separated" parameter
                // (upload hash)
                + params.key.split('/').slice(-1);

        var xAmzCredential = config.EVENID_AWS.ACCESS_KEY_ID 
            + '/' + currentDateFormated
            + '/' + config.EVENID_AWS.S3.REGION 
            + '/s3/aws4_request';

        var policy = awsS3.policy(expiresAt.unix(), [
            {'bucket': config.EVENID_AWS.S3.BUCKETS.UPLOADS},
            ['eq', '$key', key],
            {'acl': acl},
            ['starts-with', '$Content-Type', 'image/'],
            // Between 10 octets and MAX_SIZE.
            ['content-length-range', 10, maxContentLength],
            {'success_action_redirect': successActionRedirect},
            {'Cache-Control': maxAge},
            {'x-amz-algorithm': 'AWS4-HMAC-SHA256'},
            {'x-amz-credential': xAmzCredential},
            {'x-amz-date': currentDateISOFormated}
        ]);

        assert.strictEqual(Object.keys(body).length, 2);

        assert.strictEqual(params['x-amz-algorithm'], 
                           'AWS4-HMAC-SHA256');

        assert.strictEqual(params['x-amz-credential'], 
                           xAmzCredential);

        assert.strictEqual(params['x-amz-date'], 
                           currentDateISOFormated);

        assert.strictEqual(params.acl, acl);
        assert.strictEqual(params.key, key);

        assert.strictEqual(params['Content-Type'], 'image/png');
        assert.strictEqual(params['Cache-Control'], maxAge);

        assert.strictEqual(
            params.success_action_redirect,
            successActionRedirect
        );

        // Base 64
        assert.strictEqual(params.policy, policy);

        assert.strictEqual(params['x-amz-signature'], 
                           awsS3.signatureForPolicy(currentDateFormated, policy));

        assert.strictEqual(body.formAction, 
                           AWSS3.bucketURL(config.EVENID_AWS.S3.BUCKETS.UPLOADS));
    };
};

describe('GET /uploads/policy', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, entity, redirectURL) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;
                    var qs = {
                        entity: entity || 'user',
                        // `RedirectUrl` may be empty so check against `undefined`
                        redirect_url: Type.is(redirectURL, undefined) 
                            ? successActionRedirect 
                            : redirectURL
                    };

                    request(app)
                        .get('/uploads/policy')
                        .set('Authorization', authHeader)
                        .query(qs)
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
                    return cb(null, this.accessToken, 
                              this.entity, this.redirectURL);
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
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        makeARequest.call({
            accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368'
        }, 400, /invalid_token/, done);
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
                }, 400, /expired_token/, done);
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
                }, 400, /invalid_token/, done);
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
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid entity was passed', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                entity: 'foo'
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when redirect url was not set', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                redirectURL: ''
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when max attempts were reached for client', function (done) {

        var oldValue = config.EVENID_EVENTS
                             .MAX_ATTEMPTS
                             .UPLOAD_POLICY_GENERATED;

        config.EVENID_EVENTS
              .MAX_ATTEMPTS
              .UPLOAD_POLICY_GENERATED = 1;

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: accessToken,
                entity: 'client'
            }, 200, uploadPolicyReg, function (err, resp) {

                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    entity: 'client'
                }, 403, new RegExp(
                    '(?=.*error)(?=.*max_attempts_reached)'
                ), function (err, resp) {
                
                    if (err) {
                        return done(err);
                    }

                    config.EVENID_EVENTS
                          .MAX_ATTEMPTS
                          .UPLOAD_POLICY_GENERATED = oldValue;

                    done();
                });
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when max attempts were reached for user', function (done) {

        var oldValue = config.EVENID_EVENTS
                             .MAX_ATTEMPTS
                             .UPLOAD_POLICY_GENERATED;

        config.EVENID_EVENTS
              .MAX_ATTEMPTS
              .UPLOAD_POLICY_GENERATED = 1;

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                entity: 'user'
            }, 200, uploadPolicyReg, function (err, resp) {

                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    entity: 'user'
                }, 403, new RegExp(
                    '(?=.*error)(?=.*max_attempts_reached)'
                ), function (err, resp) {
                
                    if (err) {
                        return done(err);
                    }

                    config.EVENID_EVENTS
                          .MAX_ATTEMPTS
                          .UPLOAD_POLICY_GENERATED = oldValue;

                    done();
                });
            });
        });
    });

    it('responds with HTTP code 200 and valid upload '
       + 'policy for owned client', function (done) {

        getAppAccessToken(function (err, accessToken) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                entity: 'client'
            }, 200, uploadPolicyReg, function (err, resp) {
                if (err) {
                    return done(err);
                }
                
                isValidUploadPolicy('client')(resp);

                done();
            });
        });
    });

    it('responds with HTTP code 200 and '
       + 'valid upload policy for user', function (done) {

        makeARequest(200, uploadPolicyReg, function (err, resp) {
            if (err) {
                return done(err);
            }
            
            isValidUploadPolicy('user')(resp);

            done();
        });
    });
});