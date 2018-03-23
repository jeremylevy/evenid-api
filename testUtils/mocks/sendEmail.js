var util = require('util');
var nock = require('nock');

var path = require('path');
var jade = require('jade');

var querystring = require('querystring');
var striptags = require('striptags');

var config = require('../../config');

var localesData = require('../../locales/data');

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

function fixedEncodeURIComponent (str) {
    return str.replace(/[!'()*]/g, function(c) {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    });
}

module.exports = function (messageKey, messageArgs, subject, clientName, clientLogo, link, to) {
    var scopes = [];

    var htmlBody = jade.renderFile(path.resolve(__dirname, '../../templates/emails/base.jade'), {
        client: {
            name: clientName,
            logo: clientLogo
        },
        content: message('html', 'en-us', messageKey, messageArgs)
    });

    var textBody = message('text', 'en-us', messageKey, messageArgs);

    var reqBody = {
        'Action': 'SendEmail',
        'Destination.ToAddresses.member.1': to,
        'Message.Body.Html.Charset': 'UTF-8',
        'Message.Body.Html.Data': htmlBody,
        'Message.Body.Text.Charset': 'UTF-8',
        'Message.Body.Text.Data': textBody,
        'Message.Subject.Charset': 'UTF-8',
        'Message.Subject.Data': subject,
        'ReplyToAddresses.member.1': config.EVENID_EMAILS.REPLY_TO_ADDRESSES,
        'ReturnPath': config.EVENID_EMAILS.RETURN_PATH,
        'Source': util.format(config.EVENID_EMAILS.SOURCE, clientName),
        'Version': '2010-12-01'
    };
    
    scopes.push(
        nock('https://email.eu-west-1.amazonaws.com:443')
            .post('/', fixedEncodeURIComponent(querystring.stringify(reqBody)))
            .reply(200, '<SendEmailResponse xmlns="http://ses.amazonaws.com/doc/2010-12-01/">'
                   + '<SendEmailResult><MessageId>000001501594606c-7d97e905-9804-453c-80b2-6ba23489c63f-000000</MessageId>'
                   + '</SendEmailResult><ResponseMetadata><RequestId>07691564-661d-11e5-b788-abc56805d3cc</RequestId>'
                   + '</ResponseMetadata></SendEmailResponse>')
    );

    return scopes;
};