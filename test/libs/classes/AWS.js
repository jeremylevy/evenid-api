var assert = require('assert');

var AWS = require('../../../libs/classes/AWS');

// Example taken from http://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-post-example.html
var aws = new AWS('us-east-1', 's3', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');

describe('libs.classes.AWS', function () {
    /* Constructor */

    it('throws an exception when passing invalid aws region', function () {
        [null, undefined, {}, 9, [], '', 'foo'].forEach(function (v) {
            assert.throws(function () {
                new AWS(v, 'foo');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string value as `awsService`', function () {
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                new AWS('eu-west-1', v, 'bar');
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing empty string as `awsService`', function () {
        assert.throws(function () {
            new AWS('eu-west-1', '', 'bar');
        }, assert.AssertionError);
    });

    it('throws an exception when passing non-string value as `secretAccessKey`', function () {
        [null, undefined, {}, 9, []].forEach(function (v) {
            assert.throws(function () {
                new AWS('eu-west-1', 's3', v);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing '
       + 'empty string as `secretAccessKey`', function () {
        
        assert.throws(function () {
            new AWS('eu-west-1', 's3', '');
        }, assert.AssertionError);
    });

    /* signatureFor() method */

    it('throws an exception when passing invalid value '
       + 'as `currentDate` for `signatureFor method', function () {

        [null, undefined, {}, 'bar', []].forEach(function (v) {
            assert.throws(function () {
                aws.signatureFor(v, 'bar');
            }, assert.AssertionError);
        });
    });


    it('throws an exception when passing non-string '
       + 'value as `stringToSign` for `signatureFor` method', function () {

        [null, undefined, {}, 0.9, []].forEach(function (v) {
            assert.throws(function () {
                aws.signatureFor('20120613', v);
            }, assert.AssertionError);
        });
    });

    it('returns valid signature when passing base64 '
       + 'value as `policy` for `signatureFor` method', function () {

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

        var signature = aws.signatureFor('20130806', policy);

        assert.strictEqual(signature, expectedSignature);
    });
});