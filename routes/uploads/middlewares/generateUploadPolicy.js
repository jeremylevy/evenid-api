var moment = require('moment');
var validator = require('validator');

var config = require('../../../config');

var AWSS3 = require('../../../libs/classes/AWSS3');
var getUploadHash = require('../../../libs/getUploadHash');

var InvalidRequestError = require('../../../errors/types/InvalidRequestError');
var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (req, res, next) {
    var entity = validator.trim(req.query.entity);
    var redirectURL = validator.trim(req.query.redirect_url);

    var user = res.locals.user;

    var currentDate = moment.utc().set({
        'hour': 0,
        'minute': 0,
        'second': 0,
        'millisecond': 0
    });
    var currentDateFormated = currentDate.format('YYYYMMDD');
    // AWS doesn't want separators
    var currentDateISOFormated = currentDate.toISOString()
                                            .replace(/-|:|\./g, '');

    var expiresAt = moment.utc().add(5, 'seconds');
    var hash = getUploadHash();

    var policy = null;
    var signatureForPolicy = null;
    var params = {};

    var acl = config.EVENID_PHOTOS
                    .PROPERTIES
                    .ACL;
    var key = '';

    var maxAge = 'max-age=' + config.EVENID_PHOTOS
                                    .PROPERTIES
                                    .CACHE_CONTROL_MAX_AGE;
    var maxContentLength = 0;

    var xAmzCredential = config.EVENID_AWS.ACCESS_KEY_ID 
        + '/' + currentDateFormated
        + '/' + config.EVENID_AWS.S3.REGION 
        + '/s3/aws4_request';
    
    var awsS3 = new AWSS3(config.EVENID_AWS.S3.REGION, 
                          config.EVENID_AWS.ACCESS_KEY_SECRET);

    // Check passed entity
    if (['client', 'user'].indexOf(entity) === -1) {
        return next(new InvalidRequestError({
            entity: !entity 
                ? 'The "entity" parameter must be set in querystring.' 
                : 'The "entity" parameter is invalid.'
        }));
    }

    // Check that redirect url was set
    if (!redirectURL) {
        return next(new InvalidRequestError({
            redirect_url: 'The "redirect_url" parameter must be set in querystring.'
        }));
    }

    if (entity === 'user') {
        key = 'users/profil-photos/' + hash;
        maxContentLength = config.EVENID_PHOTOS
                                 .MAX_FILE_SIZES
                                 .USER_PROFIL_PHOTOS;
    }

    if (entity === 'client') {
        key = 'clients/logos/' + hash;
        maxContentLength = config.EVENID_PHOTOS
                                 .MAX_FILE_SIZES
                                 .CLIENT_LOGOS;
    }
    
    policy = awsS3.policy(expiresAt.unix(), [
        {'bucket': config.EVENID_AWS.S3.BUCKETS.UPLOADS},
        ['eq', '$key', key],
        {'acl': acl},
        ['starts-with', '$Content-Type', 'image/'],
        // Between 10 octets and MAX_SIZE.
        ['content-length-range', 10, maxContentLength],
        {'success_action_redirect': redirectURL},
        {'Cache-Control': maxAge},
        {'x-amz-algorithm': 'AWS4-HMAC-SHA256'},
        {'x-amz-credential': xAmzCredential},
        {'x-amz-date': currentDateISOFormated}
    ]);

    signatureForPolicy = awsS3.signatureForPolicy(currentDateFormated, policy);

    params = {
        'x-amz-algorithm': 'AWS4-HMAC-SHA256',
        'x-amz-credential': xAmzCredential,
        'x-amz-date': currentDateISOFormated,
        acl: acl,
        key: key,
        'Content-Type': 'image/png',
        'Cache-Control': maxAge,
        success_action_redirect: redirectURL,
        policy: policy,
        'x-amz-signature': signatureForPolicy
    };

    res.locals.generatedPolicy = {
        params: params,
        formAction: AWSS3.bucketURL(config.EVENID_AWS.S3.BUCKETS.UPLOADS)
    };

    next();
};