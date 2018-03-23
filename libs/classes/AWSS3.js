var assert = require('assert');
var Type = require('type-of-is');

var util = require('util');
var crypto = require('crypto');

var moment = require('moment');
var validator = require('validator');

var AWS = require('./AWS');

util.inherits(AWSS3, AWS);

function AWSS3 (awsRegion, secretAccessKey) {
    // Asserts are set in parent class
    AWS.call(this, awsRegion, 's3', secretAccessKey);
}

AWSS3.bucketURL = function (bucketName) {
    assert.ok(Type.is(bucketName, String),
            'argument `bucketName` must be a string');

    assert.ok(bucketName.length > 0,
            'argument `bucketName` must not be empty');

    return 'https://' + bucketName + '.s3.amazonaws.com';
};

AWSS3.prototype.policy = function (expiresAt, conditions) {
    assert.ok(Type.is(expiresAt, Number),
            'argument `expiresAt` must be a timestamp');

    assert.ok(Type.is(conditions, Array),
            'argument `conditions` must be an array');

    var policy = {
        expiration: moment.unix(expiresAt).toISOString(),
        conditions: conditions
    };

    policy = JSON.stringify(policy);

    return new Buffer(policy).toString('base64');
};

AWSS3.prototype.signatureForPolicy = function (currentDate, policy) {
    assert.ok(Type.is(currentDate, String) 
              && !!currentDate.match(/^[0-9]{8}$/),
            'argument `currentDate` must follow `YYYYMMDD` pattern');
    
    assert.ok(validator.isBase64(policy),
            'argument `policy` must be base64 encoded');

    return this.signatureFor(currentDate, policy);
};

module.exports = AWSS3;