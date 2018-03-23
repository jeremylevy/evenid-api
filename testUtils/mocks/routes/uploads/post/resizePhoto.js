var nock = require('nock');

module.exports = function () {
    var scopes = [];

    scopes.push(
        nock('http://dummyimage.com')
            .get('/200x400/000/fff.png').replyWithFile(200, __dirname + '/test.ico', {
                'Content-Type': 'image/vnd.microsoft.icon'
            })
    );

    return scopes;
};