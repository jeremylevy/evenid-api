var assert = require('assert');
var Type = require('type-of-is');

var util = require('util');
var path = require('path');

var AWS = require('aws-sdk');
var jade = require('jade');

var striptags = require('striptags');

var config = require('../config');

var localesData = require('../locales/data');

module.exports = function (sendTo, clientName, clientLogo, subject, 
                           messageLocale, messageKey, messageArgs, cb) {

    assert.ok(Type.is(sendTo, Array),
            'argument `sendTo` must be an array');

    assert.ok(Type.is(clientName, String),
            'argument `clientName` must be a string');

    assert.ok(Type.is(clientLogo, String),
            'argument `clientLogo` must be a string');

    assert.ok(Type.is(subject, String),
            'argument `subject` must be a string');

    assert.ok(config.EVENID_LOCALES.ENABLED.indexOf(messageLocale) !== -1,
            'argument `messageLocale` must be a string');
    
    assert.ok(Type.is(messageKey, String),
            'argument `messageKey` must be a string');
    
    assert.ok(Type.is(messageArgs, Array),
            'argument `messageArgs` must be an array');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    var ses = new AWS.SES({
        accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
        secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
        region: config.EVENID_AWS.SES.REGION,
        sslEnabled: true
    });

    var message = function (type, messageLocale, messageKey, messageArgs) {
        var joinSep = '\\r\\n\\r\\n';
        var message = null;
        var emails = localesData[messageLocale].emails;
        var sentences = emails[messageKey];

        if (type === 'html') {
            joinSep = '<br /><br />';
        }

        message = sentences.join(joinSep);
        // Replace all placeholders by passing
        // an array.
        message = util.format.apply(util.format, [message].concat(messageArgs));

        if (type === 'html') {
            message = '<p>' + message + '</p>';
        }

        if (type === 'text') {
            message = striptags(message);
        }

        return message;
    };

    if (process.env.IS_TEST_FROM_APP) {
        return cb(null);
    }

    if (config.ENV !== 'test') {
        // The HTML Form's subject line was the same, for every different message. 
        // As a result gmail thinks the new emails coming in where connecting to 
        // the original message, when they don't. Subject lines are now unique.
        // See http://stackoverflow.com/questions/16689882/gmail-wraps-certain-html-elements-in-a-class-called-im
        subject += ' (' + (new Date).toISOString() + ')';
    }

    ses.sendEmail({
        Destination: {
            ToAddresses: sendTo
        },
        
        Message: {
            Body: {
                Html: {
                    Data: 
                        jade.renderFile(path.resolve(__dirname, '../templates/emails/base.jade'), {
                            client: {
                                name: clientName,
                                logo: clientLogo
                            },
                            content: message('html', messageLocale, messageKey, messageArgs)
                        }),
                    Charset: 'UTF-8'
                },
                
                Text: {
                    Data: message('text', messageLocale, messageKey, messageArgs),
                    Charset: 'UTF-8' 
                }
            },
            
            Subject: {
                Data: subject,
                Charset: 'UTF-8'
            }
        },
      
        Source: util.format(config.EVENID_EMAILS.SOURCE, clientName),
        
        // If the recipient replies to the message, 
        // each reply-to address will receive the reply
        ReplyToAddresses: config.EVENID_EMAILS.REPLY_TO_ADDRESSES,
        
        // The email address to which bounces 
        // and complaints will be forwarded
        ReturnPath: config.EVENID_EMAILS.RETURN_PATH
    }, function (err, resp) {
        if (err) {
            return cb(err);
        }

        cb(null, resp);
    });
};