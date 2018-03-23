var validator = require('validator');
var async = require('async');

var config = require('../../../config');

var db = require('../../../models');

var findUserToSetInResponseLocals = require('../../../models/actions/findUserToSetInResponseLocals');

var createHash = require('../../../libs/createHash');

var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var InvalidTokenError = require('../../../errors/types/InvalidTokenError');
var ExpiredTokenError = require('../../../errors/types/ExpiredTokenError');

module.exports = function (req, res, next) {
    var context = this;
    // Used after user log or register on client page
    // to set the same response locals 
    // (`res.locals.accessToken` and `res.locals.user`)
    // than when passing access token during request.
    // Good to have the same locals in middlewares 
    // shared between Oauth authorize and app.
    var usedDuringOauthAuthorizeLogin = context && context.name === 'oauthAuthorizeLogin';
    
    var authorizationHeader = validator.trim(req.get('authorization'));
    
    var accessToken = usedDuringOauthAuthorizeLogin 
                        ? context.accessToken 
                        : validator.trim(req.query.access_token);

    var accessTokenPattern = config.EVENID_OAUTH.PATTERNS.TOKENS;
    var authorizationHeaderPattern = '^Bearer ' + accessTokenPattern + '$';

    var invalidTokenError = new InvalidTokenError();
    var expiredTokenError = new ExpiredTokenError();
    
    // We don't need to check access token
    // for whitelist (during inspect token for example)
    if (req.path.match(config.EVENID_API.ACCESS_TOKEN_WHITELIST.join('|'))
        // Called as function during Oauth authorize
        && !usedDuringOauthAuthorizeLogin) {

        return next('route');
    }
    
    // Access token is set when user is in the process of login
    // on client page during oauth authorization.
    // Or passed by query string not `Authorization` header
    if (!accessToken) {
        // Missing access token
        if (!authorizationHeader) {
            return next(
                new InvalidRequestError({
                    access_token: 'This method needs an access token.'
                })
            );
        }

        // Check Authorization header format
        if (!authorizationHeader.match(new RegExp(authorizationHeaderPattern))) {
            return next(
                new InvalidRequestError({
                    authorization_header: 'Authorization header is invalid.'
                })
            );
        }
        
        // Get access token
        accessToken = authorizationHeader.split(' ')[1];
    } else {
        // Check access token format
        if (!accessToken.match(new RegExp('^' + accessTokenPattern + '$'))) {
            return next(invalidTokenError);
        }
    }

    async.auto({
        findAccessToken: function (cb) {
            // Find access token
            var query = db.models.OauthAccessToken.findOne({
                token: createHash(config.EVENID_OAUTH
                                        .HASHING_ALGORITHMS
                                        .TOKENS, accessToken)
            });

            query.populate('authorization');

            query.exec(function (err, accessToken) {
                if (err) {
                    return cb(err);
                }
                
                if (!accessToken
                    // In case of error during 
                    // Oauth authorization deletion
                    || !accessToken.authorization) {

                    return cb(invalidTokenError);
                }

                // Pass special error in order to known
                // when to use refresh token
                if (accessToken.expires_at <= new Date()) {
                    return cb(expiredTokenError);
                }

                // Give access to access token in next middlewares
                res.locals.accessToken = accessToken;

                cb(null, accessToken);
            });
        },

        findCorrespondingUser: ['findAccessToken', function (cb, results) {
            var accessToken = results.findAccessToken;

            // Unauthenticated app
            if (accessToken.authorization.type === 'client_credentials') {
                return cb(null);
            }

            findUserToSetInResponseLocals(accessToken.authorization.issued_for,
                                          function (err, user) {
                
                if (err) {
                    return cb(err);
                }

                if (!user) {
                    return cb(invalidTokenError);
                }

                // Give access to user in next middlewares
                res.locals.user = user;

                cb(null, user);
            });
        }]
    }, function (err, results) {
        if (err) {
            return next(err);
        }

        // Valid access token pass
        usedDuringOauthAuthorizeLogin
            ? next(null, 'ok') 
            : next('route');
    });
};