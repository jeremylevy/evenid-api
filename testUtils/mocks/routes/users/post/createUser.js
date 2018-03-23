var nock = require('nock');

var config = require('../../../../../config');

module.exports = function () {
    var scopes = [];

    scopes.push(
        nock('https://www.google.com')
            .get('/recaptcha/api/siteverify')
            .query({
                secret: config.EVENID_RECAPTCHA.PRIVATE_KEY,
                response: 'TEST_INVALID_CAPTCHA',
                remoteip: '192.168.13.2'
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
                response: 'TEST_VALID_CAPTCHA',
                remoteip: '192.168.13.3'
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
                response: 'TEST_VALID_CAPTCHA',
                remoteip: '127.0.0.1'
            })
            .reply(200, {
                success: true
            })
    );

    return scopes;
};