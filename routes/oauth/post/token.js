var setResponseLocals = require('../middlewares/token/setResponseLocals');

var checkRequest = require('../middlewares/token/checkRequest');
var checkClient = require('../middlewares/token/checkClient');

var clientCredentialsGrantType = require('../middlewares/token/clientCredentialsGrantType');
var passwordGrantType = require('../middlewares/token/passwordGrantType');

var authorizationCodeGrantType = require('../middlewares/token/authorizationCodeGrantType');
var refreshTokenGrantType = require('../middlewares/token/refreshTokenGrantType');

module.exports = function (app, express) {
    app.post('/oauth/token', 
             setResponseLocals, 
             checkRequest, 
             checkClient, 
             clientCredentialsGrantType, 
             passwordGrantType, 
             authorizationCodeGrantType, 
             refreshTokenGrantType);
};