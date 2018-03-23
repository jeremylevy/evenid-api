var assert = require('assert');
var Type = require('type-of-is');

var verifyRecaptcha = require('../../libs/verifyRecaptcha');

var IPHeaderMissingError = require('../../errors/types/IPHeaderMissingError');
var IPHeaderInvalidError = require('../../errors/types/IPHeaderInvalidError');

var MaxAttemptsError = require('../../errors/types/MaxAttemptsError');
var ServerError = require('../../errors/types/ServerError');

var verifyRecaptchaMock = require('../../testUtils/mocks/libs/verifyRecaptcha/verifyRecaptcha');

var validReqObject = {
    get: function (header) {
        if (header.toLowerCase() !== 'x-originating-ip') {
            return undefined;
        }

        return '127.0.0.1';
    },

    body: {
        'g-recaptcha-response': ''
    }
};

describe('libs.verifyRecaptcha', function () {
    var mockScopes = [];

    before(function () {
        // Make sure mocks are not set
        // before THIS test run
        mockScopes = verifyRecaptchaMock();
    });

    // Make sure all requests were made
    after(function() {
        mockScopes.forEach(function (mockScope) {
            assert.ok(mockScope.isDone());
        });
    });

    it('throws an exception when passing invalid request object', function () {
        [null, undefined, {}, {headers: ''}, 
        {body: {}}, {headers: {'x-originating-ip': null}, body: null},
         9, [], ''].forEach(function (v) {
            
            assert.throws(function () {
                verifyRecaptcha(v, function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                verifyRecaptcha(validReqObject, v);
            }, assert.AssertionError);
        });
    });

    it('calls callback with an error when missing IP header', function (done) {
        var oldGetFn = validReqObject.get;

        validReqObject.get = function () {
            return undefined;
        };

        verifyRecaptcha(validReqObject, function (err, success) {
            
            // Make sure returned error 
            // is an instance of `IPHeaderInvalidError`
            assert.ok(Type.instance(err, IPHeaderMissingError));

            assert.strictEqual(success, false);

            // Go back to default value
            validReqObject.get = oldGetFn;

            done();
        });
    });

    it('calls callback with an error when passing invalid IP header', function (done) {
        var oldGetFn = validReqObject.get;

        validReqObject.get = function (header) {
            if (header.toLowerCase() !== 'x-originating-ip') {
                return undefined;
            }

            return 'bar';
        };

        verifyRecaptcha(validReqObject, function (err, success) {
            
            // Make sure returned error 
            // is an instance of `IPHeaderInvalidError`
            assert.ok(Type.instance(err, IPHeaderInvalidError));

            assert.strictEqual(success, false);

            // Go back to default value
            validReqObject.get = oldGetFn;

            done();
        });
    });

    it('calls callback with max attempts error when invalid captcha', function (done) {
        validReqObject.body['g-recaptcha-response'] = 'TEST_MAX_ATTEMPTS_ERROR';

        verifyRecaptcha(validReqObject, function (err, success) {
            
            // Make sure returned error 
            // is an instance of `MaxAttemptsError`
            assert.ok(Type.instance(err, MaxAttemptsError));

            assert.strictEqual(err.captchaError, true);

            assert.strictEqual(success, false);

            // Go back to default value
            validReqObject.body['g-recaptcha-response'] = '';

            done();
        });
    });

    it('calls callback with server error when HTTP error', function (done) {
        validReqObject.body['g-recaptcha-response'] = 'TEST_HTTP_ERROR';

        verifyRecaptcha(validReqObject, function (err, success) {
            
            // Make sure returned error 
            // is an instance of `ServerError`
            assert.ok(Type.instance(err, ServerError));

            assert.strictEqual(success, false);

            // Go back to default value
            validReqObject.body['g-recaptcha-response'] = '';

            done();
        });
    });

    it('calls callback with server error when unknown error', function (done) {
        validReqObject.body['g-recaptcha-response'] = 'TEST_SERVER_ERROR';

        verifyRecaptcha(validReqObject, function (err, success) {
            
            // Make sure returned error 
            // is an instance of `ServerError`
            assert.ok(Type.instance(err, ServerError));

            assert.strictEqual(success, false);

            // Go back to default value
            validReqObject.body['g-recaptcha-response'] = '';

            done();
        });
    });

    it('calls callback with success when passsing valid response', function (done) {
        validReqObject.body['g-recaptcha-response'] = 'TEST_VALID_VALUE';

        verifyRecaptcha(validReqObject, function (err, success) {
            assert.strictEqual(err, null);
            assert.strictEqual(success, true);

            // Go back to default value
            validReqObject.body['g-recaptcha-response'] = '';

            done();
        });
    });
});