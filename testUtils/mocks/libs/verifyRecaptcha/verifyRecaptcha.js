var nock = require('nock');

var config = require('../../../../config');

module.exports = function () {
    var scopes = [];
    
    scopes.push(
        nock('https://www.google.com')
            .get('/recaptcha/api/siteverify')
            .query({
                secret: config.EVENID_RECAPTCHA.PRIVATE_KEY,
                response: 'TEST_VALID_VALUE',
                remoteip: '127.0.0.1'
            })
            .reply(200, {
                success: true
            })
    );

    scopes.push(
        nock('https://www.google.com')
            .get('/recaptcha/api/siteverify')
            .query({
                secret: config.EVENID_RECAPTCHA.PRIVATE_KEY,
                response: 'TEST_MAX_ATTEMPTS_ERROR',
                remoteip: '127.0.0.1'
            })
            .reply(200, {
                success: false,
                'error-codes': ['invalid-input-response']
            })
    );

    scopes.push(
        nock('https://www.google.com')
            .get('/recaptcha/api/siteverify')
            .query({
                secret: config.EVENID_RECAPTCHA.PRIVATE_KEY,
                response: 'TEST_HTTP_ERROR',
                remoteip: '127.0.0.1'
            })
            .reply(400, {})
    );

    scopes.push(
        nock('https://www.google.com')
            .get('/recaptcha/api/siteverify')
            .query({
                secret: config.EVENID_RECAPTCHA.PRIVATE_KEY,
                response: 'TEST_SERVER_ERROR',
                remoteip: '127.0.0.1'
            })
            .reply(200, {
                success: false,
                'error-codes': ['invalid-input-secret']
            })
    );

    return scopes;
};