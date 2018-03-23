var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var findOauthUserStatus = require('../../../models/actions/findOauthUserStatus');
var findOauthEntitiesID = require('../../../models/actions/findOauthEntitiesID');

var createHash = require('../../../libs/createHash');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');
var ServerError = require('../../../errors/types/ServerError');

var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    app.get('/oauth/inspect-token', function (req, res, next) {
        var accessToken = validator.trim(req.query.token);

        var accessTokenReg = new RegExp('^' 
                                        + config.EVENID_OAUTH.PATTERNS.TOKENS 
                                        + '$');

        if (!accessToken.match(accessTokenReg)) {
            return next(new InvalidRequestError({
                token: !accessToken 
                    ? 'Token must be set as parameter in querystring.'
                    : 'Token is invalid.'
            }));
        }

        async.auto({
            findAccessToken: function (cb) {
                var findAccessToken = db.models.OauthAccessToken.findOne({
                    token: createHash(config.EVENID_OAUTH
                                            .HASHING_ALGORITHMS
                                            .TOKENS, accessToken)
                });

                findAccessToken.populate('authorization');

                findAccessToken.exec(function (err, accessToken) {
                    if (err) {
                        return cb(err);
                    }

                    if (!accessToken 
                        || !accessToken.authorization) {
                        
                        return cb(new NotFoundError('Token was not found.'));
                    }

                    cb(null, accessToken);
                });
            },

            findOauthClient: ['findAccessToken', function (cb, results) {
                var accessToken = results.findAccessToken;
                var oauthClientID = accessToken.authorization
                                               .issued_to
                                               .client;

                // App access token
                if (!oauthClientID) {
                    return cb(
                        new AccessDeniedError('The inspect token method does not '
                                              + 'work with app access tokens')
                    );
                }

                db.models.OauthClient.findById(oauthClientID, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    if (!oauthClient) {
                        return cb(new NotFoundError('Client which have issued this token was not found.'));
                    }

                    cb(null, oauthClient);
                });
            }],

            findOauthUserStatus: ['findOauthClient', function (cb, results) {
                var clientID = results.findOauthClient.id;
                var userID = results.findAccessToken
                                    .authorization
                                    .issued_for;

                findOauthUserStatus(clientID, userID, function (err, oauthUserStatus) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserStatus.status);
                });
            }],

            findUserIDForClient: ['findOauthClient', function (cb, results) {
                var clientID = results.findOauthClient.id;
                var userID = results.findAccessToken
                                    .authorization
                                    .issued_for;

                findOauthEntitiesID({
                    real_id: userID,
                    entities: ['users']
                }, userID, clientID, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    if (oauthEntitiesID.length !== 1) {
                        return cb(new ServerError([]));
                    }

                    cb(null, oauthEntitiesID[0].fake_id);
                });
            }]
        }, function (err, results) {
            var accessToken = results && results.findAccessToken;
            var oauthClient = results && results.findOauthClient;
            
            var oauthUserStatus = results && results.findOauthUserStatus;
            var userID = results && results.findUserIDForClient;

            if (err) {
                return next(err);
            }

            res.send({
                client_id: oauthClient.client_id,
                user_id: userID,
                user_status: oauthUserStatus,
                scope: accessToken.authorization.scope,
                issued_at: Math.floor(accessToken.issued_at.getTime() / 1000),
                is_expired: accessToken.expires_at <= new Date()
            });
        });
    });
};