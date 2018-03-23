var assert = require('assert');
var Type = require('type-of-is');

var crypto = require('crypto');
var moment = require('moment');
var validator = require('validator');

var validAWSRegions = [
    'ap-northeast-1', 
    'ap-southeast-1',
    'ap-southeast-2',
    'eu-central-1',
    'eu-west-1',
    'sa-east-1',
    'us-east-1',
    'us-west-1',
    'us-west-2'
];

module.exports = AWS;

function AWS(awsRegion, awsService, secretAccessKey) {
    assert.ok(validAWSRegions.indexOf(awsRegion) !== -1,
            'argument `awsRegion` is invalid');

    assert.ok(Type.is(awsService, String),
            'argument `awsService` must be a string');

    assert.ok(awsService.length > 0,
            'argument `awsService` must not be empty');

    assert.ok(Type.is(secretAccessKey, String),
            'argument `secretAccessKey` must be a string');

    assert.ok(secretAccessKey.length > 0,
            'argument `secretAccessKey` must not be empty');
    
    this.awsRegion = awsRegion;
    this.awsService = awsService;
    this.secretAccessKey = secretAccessKey;
}

// http://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-authenticating-requests.html#signing-request-intro
AWS.prototype.signatureFor = function (currentDate, stringToSign) {
    assert.ok(Type.is(currentDate, String) 
              && !!currentDate.match(/^[0-9]{8}$/),
            'argument `currentDate` must follow `YYYYMMDD` pattern');

    assert.ok(Type.is(stringToSign, String),
              'argument `stringToSign` must be a string');

    var signingKey = null;

    signingKey = crypto.createHmac('sha256', 'AWS4' + this.secretAccessKey)
                        .update(currentDate, 'utf8')
                        .digest();

    signingKey = crypto.createHmac('sha256', signingKey)
                        .update(this.awsRegion, 'utf8')
                        .digest();

    signingKey = crypto.createHmac('sha256', signingKey)
                        .update(this.awsService, 'utf8')
                        .digest();
                       
    signingKey = crypto.createHmac('sha256', signingKey)
                        .update('aws4_request', 'utf8')
                        .digest();

    return crypto.createHmac('sha256', signingKey)
                .update(stringToSign)
                .digest('hex');
};