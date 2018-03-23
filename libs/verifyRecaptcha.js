var assert = require('assert');
var net = require('net');

var Type = require('type-of-is');
var validator = require('validator');

var Recaptcha = require('no-captcha');

var config = require('../config');

var IPHeaderMissingError = require('../errors/types/IPHeaderMissingError');
var IPHeaderInvalidError = require('../errors/types/IPHeaderInvalidError');

var MaxAttemptsError = require('../errors/types/MaxAttemptsError');
var ServerError = require('../errors/types/ServerError');

module.exports = function (req, cb) {
    // `req` is not an object literal !!!
    assert.ok(req,
            'argument `req` must be set');

    assert.ok(Type.is(req.get, Function),
            'argument `req` must have a `get` function');
    
    assert.ok(Type.is(req.body, Object),
            'argument `req` must have a `body` property set as object');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    var recaptchaResponse = validator.trim(req.body['g-recaptcha-response']);
    var userIPAddress = validator.trim(req.get('x-originating-ip'));

    var recaptchaData = {
        response: recaptchaResponse,
        remoteip: userIPAddress
    };

    var recaptcha = new Recaptcha(config.EVENID_RECAPTCHA.PUBLIC_KEY, 
                                  config.EVENID_RECAPTCHA.PRIVATE_KEY);

    if (!userIPAddress) {
        return cb(new IPHeaderMissingError(), false);
    }

    if (net.isIP(userIPAddress) === 0) {
        return cb(new IPHeaderInvalidError(), false);
    }

    recaptcha.verify(recaptchaData, function (err, response) {
        var error = null;
        var errorCodes = [];
        var success = true;

        if (err) {
            // Error codes [...] 
            // casted as string
            // https://developers.google.com/recaptcha/docs/verify
            errorCodes = err.message.split(',');
            success = false;

            if (errorCodes.indexOf('missing-input-response') !== -1
                || errorCodes.indexOf('invalid-input-response') !== -1) {

                // Invalid captcha
                // Pass `MaxAttemptsError` with 
                // default message and
                // `captchaError` property set to 
                // `true` in order to tell
                // app to not only re-display captcha 
                // but also display captcha error
                error = new MaxAttemptsError(null, true);
            } else {
                error = new ServerError([new Error(err.message)]);
            }
        }

        cb(error, success);
    });
};