var assert = require('assert');
var moment = require('moment');
var crypto = require('crypto');

var AWSS3 = require('../../../libs/classes/AWSS3');

// Example taken from http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html
var s3 = new AWSS3('us-east-1', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');

describe('libs.classes.AWSS3', function () {

    /* Constructor */

    it('throws an exception when passing invalid aws region', function () {
        [null, undefined, {}, 9, [], '', 'foo'].forEach(function (v) {
            assert.throws(function () {
                new AWSS3(v, 'secretAccessKey');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string value as `secretAccessKey`', function () {
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                new AWSS3('eu-west-1', v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing empty string as `secretAccessKey`', function () {
        assert.throws(function () {
            new AWSS3('eu-west-1', '');
        }, assert.AssertionError);
    });

    /* bucketURL() method */

    it('throws an exception when passing non-string '
       + 'value as `bucketName` for `bucketURL` method', function () {

        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                AWSS3.bucketURL(v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing empty string '
       + 'as `bucketName` for `bucketURL` method', function () {

        assert.throws(function () {
            AWSS3.bucketURL('');
        }, assert.AssertionError);
    });

    it('returns bucket URL when passing '
       + 'valid bucket name for `bucketURL` method', function () {
        
        var bucketName = 'bar';

        assert.strictEqual(AWSS3.bucketURL(bucketName), 
                           'https://' + bucketName + '.s3.amazonaws.com');
    });

    /* policy() method */

    it('throws an exception when passing non-number '
       + 'value as `expiresAt` for `policy` method', function () {

        [null, undefined, {}, 'bar', []].forEach(function (v) {
            assert.throws(function () {
                s3.policy(v, []);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-array '
       + 'value as `conditions` for `policy` method', function () {

        [null, undefined, {}, 'bar', 9.8].forEach(function (v) {
            assert.throws(function () {
                s3.policy(103984084, v);
            }, assert.AssertionError);
        });
    });

    it('returns policy when passing valid expiration '
       + 'date and conditions for `policy` method', function () {
        
        var expiresAt = 103984084;
        var expiresAtISO = moment.unix(expiresAt).toISOString();
        var conditions = [{foo: 'bar'}]

        assert.doesNotThrow(function () {
            var policy = s3.policy(expiresAt, conditions);

            // From Base64
            policy = new Buffer(policy, 'base64').toString('utf-8');
            // To JSON
            policy = JSON.parse(policy);

            assert.strictEqual(policy.expiration, expiresAtISO);
            assert.deepEqual(policy.conditions, conditions);
        });
    });

    /* signatureForPolicy() method */

    it('throws an exception when passing invalid value '
       + 'as `currentDate` for `signatureForPolicy` method', function () {

        [null, undefined, {}, 'bar', []].forEach(function (v) {
            assert.throws(function () {
                s3.signatureForPolicy(v, 'eyAiZXhwaXJhdGlvbiI6ICIyMDEzLT==');
            }, assert.AssertionError);
        });
    });


    it('throws an exception when passing non-base64 '
       + 'value as `policy` for `signatureForPolicy` method', function () {

        [null, undefined, {}, 'bar', []].forEach(function (v) {
            assert.throws(function () {
                s3.signatureForPolicy('20120613', v);
            }, assert.AssertionError);
        });
    });

    it('returns valid signature when passing base64 '
       + 'value as `policy` for `signatureForPolicy` method', function () {

        /* Example taken from http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html */
        
        var policy = 'eyAiZXhwaXJhdGlvbiI6ICIyMDEzLTA4LTA3VDEyOjAwOjAwLjAwMFoiLA0KICAiY29uZGl0aW9ucy'
                    + 'I6IFsNCiAgICB7ImJ1Y2tldCI6ICJleGFtcGxlYnVja2V0In0sDQogICAgWyJzdGFydHMtd2l0aCIs'
                    + 'ICIka2V5IiwgInVzZXIvdXNlcjEvIl0sDQogICAgeyJhY2wiOiAicHVibGljLXJlYWQifSwNCiAgICB7'
                    + 'InN1Y2Nlc3NfYWN0aW9uX3JlZGlyZWN0IjogImh0dHA6Ly9leGFtcGxlYnVja2V0LnMzLmFtYXpvbmF3'
                    + 'cy5jb20vc3VjY2Vzc2Z1bF91cGxvYWQuaHRtbCJ9LA0KICAgIFsic3RhcnRzLXdpdGgiLCAiJENvbnRlb'
                    + 'nQtVHlwZSIsICJpbWFnZS8iXSwNCiAgICB7IngtYW16LW1ldGEtdXVpZCI6ICIxNDM2NTEyMzY1MTI3NCJ9L'
                    + 'A0KICAgIFsic3RhcnRzLXdpdGgiLCAiJHgtYW16LW1ldGEtdGFnIiwgIiJdLA0KDQogICAgeyJ4LWFtei1jcm'
                    + 'VkZW50aWFsIjogIkFLSUFJT1NGT0ROTjdFWEFNUExFLzIwMTMwODA2L3VzLWVhc3QtMS9zMy9hd3M0X3JlcXVl'
                    + 'c3QifSwNCiAgICB7IngtYW16LWFsZ29yaXRobSI6ICJBV1M0LUhNQUMtU0hBMjU2In0sDQogICAgeyJ4LWFtei1'
                    + 'kYXRlIjogIjIwMTMwODA2VDAwMDAwMFoiIH0NCiAgXQ0KfQ==';

        var expectedSignature = '21496b44de44ccb73d545f1a995c68214c9cb0d41c45a17a5daeec0b1a6db047';

        var signature = s3.signatureForPolicy('20130806', policy);

        assert.strictEqual(signature, expectedSignature);
    });
});