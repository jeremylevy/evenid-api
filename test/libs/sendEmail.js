var assert = require('assert');
var proxyquire = require('proxyquire').noPreserveCache();

var util = require('util');
var striptags = require('striptags');

var config = require('../../config');

var localesData = require('../../locales/data');

var compareArray = require('../../testUtils/lib/compareArray');

var sendEmail = proxyquire('../../libs/sendEmail', {});

var sendEmailArgs = [['bar@evenid.com'], 'bar', 
                    'http://bar.com', 'bar', 
                    'en-us', 'recover_password', 
                    ['bar1', 'bar2', 'bar3'], function () {}];

describe('libs.sendEmail', function () {
    it('throws an exception when passing non-array value as recipient', function () {
        [null, undefined, {}, 9, '', 'bar'].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(0, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string value as client name', function () {
        [null, undefined, {}, [], 9].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify 
                // array so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(1, 1);

                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string value as client logo', function () {
        [null, undefined, {}, [], 9].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(2, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string value as subject', function () {
        [null, undefined, {}, [], 9].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(3, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-locale value as message locale', function () {
        [null, undefined, {}, [], 9, '', 'bar'].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(3, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-string value as message key', function () {
        [null, undefined, {}, [], 9].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(4, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-array value as message args', function () {
        [null, undefined, {}, 9, '', 'bar'].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(5, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-function value as callback', function () {
        [null, undefined, {}, 9, '', 'bar'].forEach(function (v) {
            assert.throws(function () {
                // The splice method modify array
                // so make a copy
                var args = [].concat(sendEmailArgs);

                args.splice(6, 1);
                
                sendEmail.apply(this, args);
            }, assert.AssertionError);
        });
    });

    it('passes valid options as constructor', function (done) {
        var AWSSES = function (options) {
            assert.ok(compareArray(options, {
                accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
                secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
                region: config.EVENID_AWS.SES.REGION,
                sslEnabled: true
            }));
            
            done();
        };

        AWSSES.prototype.sendEmail = function (options, cb) {
            cb(null);
        };

        proxyquire('../../libs/sendEmail', {
            'aws-sdk': {
                SES: AWSSES
            }
        }).apply(this, sendEmailArgs);
    });

    it('passes valid options as `sendEmail` method', function (done) {
        var AWSSES = function (options) {};

        AWSSES.prototype.sendEmail = function (options, cb) {
            var destination = sendEmailArgs[0];
            var clientName = sendEmailArgs[1];
            var clientLogo = sendEmailArgs[2]; 
            var subject = sendEmailArgs[3];
            var messageLocale = sendEmailArgs[4];
            var messageKey = sendEmailArgs[5];
            var messageArgs = sendEmailArgs[6];
            var message = function (type, messageLocale, messageKey, messageArgs) {
                var joinSep = '\\r\\n\\r\\n';
                var message = null;
                var emails = localesData[messageLocale].emails;
                var sentences = emails[messageKey];

                if (type === 'html') {
                    joinSep = '<br /><br />';
                }

                message = sentences.join(joinSep);
                message = util.format.apply(this, [message].concat(messageArgs));

                if (type === 'html') {
                    message = '<p>' + message + '</p>';
                }

                if (type === 'text') {
                    message = striptags(message);
                }

                return message;
            };

            assert.ok(compareArray(options.Destination.ToAddresses, destination));

            assert.ok(options.Message.Body.Html.Data.indexOf(
                message('html', messageLocale, messageKey, messageArgs)
            ) !== -1);

            // Make sure logo was 
            // included in HTML message
            assert.ok(options.Message.Body.Html.Data.indexOf(clientLogo) !== -1);

            assert.strictEqual(options.Message.Body.Html.Charset, 'UTF-8');

            assert.ok(options.Message.Body.Text.Data.indexOf(
                message('text', messageLocale, messageKey, messageArgs)
            ) !== -1);

            // Make sure logo was 
            // not included in text message
            assert.ok(options.Message.Body.Text.Data.indexOf(clientLogo) === -1);

            assert.strictEqual(options.Message.Body.Text.Charset, 'UTF-8');

            assert.strictEqual(options.Message.Subject.Data, subject);
            assert.strictEqual(options.Message.Subject.Charset, 'UTF-8');
            
            assert.strictEqual(options.Source, util.format(config.EVENID_EMAILS.SOURCE, clientName));

            assert.ok(compareArray(options.ReplyToAddresses, config.EVENID_EMAILS.REPLY_TO_ADDRESSES));

            assert.strictEqual(options.ReturnPath, config.EVENID_EMAILS.RETURN_PATH);

            cb(null);
            done();
        };

        proxyquire('../../libs/sendEmail', {
            'aws-sdk': {
                SES: AWSSES
            }
        }).apply(this, sendEmailArgs);
    });

    it('calls callback with error if error', function (done) {
        var AWSSES = function (options) {};
        var awsErr = new Error();
        var args = [].concat(sendEmailArgs);

        // Mock send email response
        AWSSES.prototype.sendEmail = function (options, cb) {
            cb(awsErr);
        };

        awsErr.name = 'aws_error';

        // Set the callback
        args[args.length - 1] = function (err, resp) {
            assert.strictEqual(err.name, awsErr.name);

            done();
        };

        proxyquire('../../libs/sendEmail', {
            'aws-sdk': {
                SES: AWSSES
            }
        }).apply(this, args);
    });

    it('calls callback with response if success', function (done) {
        var AWSSES = function (options) {};
        var args = [].concat(sendEmailArgs);
        var validResp = {
            name: 'aws_success'
        };

        // Mock send email response
        AWSSES.prototype.sendEmail = function (options, cb) {
            cb(null, validResp);
        };

        // Set the callback
        args[args.length - 1] = function (err, resp) {
            assert.ok(!err);
            
            assert.ok(compareArray(resp, validResp));

            done();
        };

        proxyquire('../../libs/sendEmail', {
            'aws-sdk': {
                SES: AWSSES
            }
        }).apply(this, args);
    });
});