var async = require('async');
var validator = require('validator');

var AWS = require('aws-sdk');

var config = require('../../../config');

var db = require('../../../models');

var findOauthEntitiesID = require('../../../models/actions/findOauthEntitiesID');
var removeOauthAuthorizations = require('../../../models/actions/removeOauthAuthorizations');

var insertOauthUserEvent = require('../../../models/actions/insertOauthUserEvent');
var updateOauthClientRegisteredUsers = require('../../../models/actions/updateOauthClientRegisteredUsers');

var updateOauthNotification = require('../../../models/actions/updateOauthNotification');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/authorized-clients/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app'), function (req, res, next) {
        var user = res.locals.user;

        var userID = req.params[0];
        var clientID = req.params[1];

        var sqs = new AWS.SQS({
            accessKeyId: config.EVENID_AWS.ACCESS_KEY_ID,
            secretAccessKey: config.EVENID_AWS.ACCESS_KEY_SECRET,
            region: config.EVENID_AWS.SQS.REGION,
            sslEnabled: true
        });

        // Check that user is access token user
        if (userID !== user.id
            // Check that user has authorized client
            || !user.hasAuthorizedClient(clientID)) {
            
            return next(new AccessDeniedError());
        }

        async.auto({
            findAuthorizationIDs: function (cb, results) {
                db.models.OauthAuthorization.find({
                    issued_for: user._id,
                    'issued_to.client': clientID
                }, '_id', function (err, authorizations) {
                    var authorizationIDs = [];

                    if (err) {
                        return cb(err);
                    }

                    if (!authorizations.length) {
                        return cb(new NotFoundError());
                    }

                    authorizations.forEach(function (authorization) {
                        authorizationIDs.push(authorization._id);
                    });

                    cb(null, authorizationIDs);
                });
            },

            // Need to be retrived BEFORE
            // `removeOauthAuthorizations`
            // delete it.
            findUserOauthID: function (cb, results) {
                findOauthEntitiesID({
                    entities: ['users']
                }, userID, clientID, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    if (!oauthEntitiesID.length) {
                        return cb(null);
                    }

                    cb(null, oauthEntitiesID[0]);
                });
            },

            removeAuthorizations: ['findAuthorizationIDs',
                                   'findUserOauthID', function (cb, results) {
                
                var authorizationIDs = results.findAuthorizationIDs;

                removeOauthAuthorizations(authorizationIDs, clientID,
                                          [user._id], function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            findClientWithRevokeAccessHook: ['removeAuthorizations', function (cb, results) {
                var req = db.models.OauthClient.findById(clientID);

                req.populate({
                    path: 'hooks',
                    match: {
                        event_type: 'USER_DID_REVOKE_ACCESS'
                    }
                });

                req.exec(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client
                        || !client.hooks.length) {
                        
                        return cb(null);
                    }

                    cb(null, client);
                });
            }],

            addOauthNotification: ['findClientWithRevokeAccessHook', function (cb, results) {
                var client = results.findClientWithRevokeAccessHook;
                var userOauthID = results.findUserOauthID;

                if (!client) {
                    return cb(null);
                }

                updateOauthNotification(client.id, userOauthID.fake_id, {
                    // Will be pushed. See method.
                    pending_notifications: [{
                        notification: JSON.stringify({
                            client_secret: client.client_secret,
                            handler_url: client.hooks[0].url,
                            notification: {
                                event_type: 'user_did_revoke_access',
                                user_id: userOauthID.fake_id,
                            }
                        })
                    }]
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            // Wait until oauth notification is added
            // given that worker need it
            insertOauthNotifInSQS: ['addOauthNotification', function (cb, results) {
                var client = results.findClientWithRevokeAccessHook;
                var userOauthID = results.findUserOauthID;

                if (!client) {
                    return cb(null);
                }

                sqs.sendMessage({
                    MessageBody: JSON.stringify([{
                        client_id: client.id,
                        user_id: userOauthID.fake_id
                    }]),
                    QueueUrl: config.EVENID_AWS.SQS.QUEUE_URL
                }, function (err, data) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            insertOauthUserEvent: ['insertOauthNotifInSQS', function (cb, results) {
                insertOauthUserEvent(userID, clientID, 'deregistration', function (err, oauthUserEvent) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthUserEvent);
                });
            }],

            updateOauthClientRegisteredUsers: ['insertOauthNotifInSQS', function (cb, results) {
                updateOauthClientRegisteredUsers(userID, clientID, -1, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }]
        }, function (err, results) {
            if (err) {
                return next(err);
            }

            res.send({});
        });
    });
};