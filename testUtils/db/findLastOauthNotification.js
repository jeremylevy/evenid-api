var AWS = require('aws-sdk');

var config = require('../../config');

module.exports = function (cb) {
    var sqs = new AWS.SQS({
        accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
        secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
        region: config.EVENID_AWS.SQS.REGION,
        sslEnabled: true
    });

    sqs.receiveMessage({
        QueueUrl: config.EVENID_AWS.SQS.QUEUE_URL
    }, function (err, data) {
        var message = data && data.Messages && data.Messages[0];

        if (err) {
            return cb(err);
        }

        if (!message) {
            return cb(null);
        }

        sqs.deleteMessage({
            QueueUrl: config.EVENID_AWS.SQS.QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle
        }, function (err) {
            if (err) {
                return cb(err);
            }

            cb(null, {
                payload: message.Body
            });
        });
    });
};