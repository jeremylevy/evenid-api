var async = require('async');
var validator = require('validator');

var passwordGrantMiddleware = require('../token/passwordGrantType');
var sendTokenRes = require('../token/sendTokenRes');

var checkAccesToken = require('../checkAccessToken');

module.exports = function (req, res, next) {
    // Given by `checkClientAndRedirectURI` middleware
    var client = res.locals.client;

    if (!client) {
        throw new Error('`client` must be set as response locals ' 
                        + 'property before calling `logUser` ' 
                        + 'middleware');
    }

    var email = validator.trim(req.body.email);
    var password = validator.trim(req.body.password);
    var persistentLogin = !!req.body.persistent_login;

    async.auto({
        logUser: function (cb) { 
            passwordGrantMiddleware.call({
                name: 'oauthAuthorize',
                email: email,
                password: password,
                sendTokenRes: sendTokenRes,
                // Used to insert access token 
                // with `logged_by_client` property
                clientID: client.id
            }, req, res, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Resp contains the same response than during token creation
                // ie. {access_token: '', refresh_token: '', user_id: ''...}
                cb(null, resp);
            });
        },

        setResponseLocals: ['logUser', function (cb, results) {
            var logUserResp = results.logUser;

            // Used to send the same response than during token creation
            // Easier to set in session
            res.locals.accessTokenToSend = logUserResp;

            // Set `res.locals.accessToken`
            // and `res.locals.user` same than
            // when passing access token during request
            checkAccesToken.call({
                name: 'oauthAuthorizeLogin',
                accessToken: logUserResp.access_token
            }, req, res, function (err, status) {
                if (err) {
                    return cb(err);
                }

                cb(null);
            });
        }]
    }, function (err, results) {
        var isLogged = !err;

        if (err) {
            return next(err, isLogged);
        }

        next(null, isLogged);
    });
};