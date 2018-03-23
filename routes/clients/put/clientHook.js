var Type = require('type-of-is');

var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/hooks/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.put(uriReg, checkScope('app_developer'), function (req, res, next) {
        var URL = !Type.is(req.body.url, undefined)
                    ? validator.trim(req.body.url) 
                    : undefined;

        var eventType = !Type.is(req.body.event_type, undefined)
                            ? validator.trim(req.body.event_type)
                            : undefined;

        var user = res.locals.user;
        
        var clientID = req.params[0];
        var hookID = req.params[1];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findClient: function (cb) {
                // Make sure hook belongs to client
                var query = db.models.OauthClient.findOne({
                    _id: clientID,
                    hooks: hookID
                });

                query.populate({
                    path: 'hooks',
                    match: {
                        _id: hookID
                    }
                });

                query.exec(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client
                        || !client.hooks.length) {
                        
                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            },

            updateHook: ['findClient', function (cb, results) {
                var client = results.findClient;
                var hook = client.hooks[0];

                var clientNeedsToBeUpdated = false;

                if (!Type.is(URL, undefined)) {
                    hook.url = URL;
                }

                if (!Type.is(eventType, undefined)) {
                    // User has updated event type
                    if (hook.event_type !== eventType) {
                        // User has chosen `USER_DID_UPDATE_PERSONAL_INFORMATION`
                        if (eventType === 'USER_DID_UPDATE_PERSONAL_INFORMATION') {
                            
                            client.update_notification_handler = hook.url;
                            clientNeedsToBeUpdated = true;
                        
                        } else if (hook.event_type === 'USER_DID_UPDATE_PERSONAL_INFORMATION') {
                            // From `USER_DID_UPDATE_PERSONAL_INFORMATION` 
                            // to other event type
                            client.update_notification_handler = undefined;
                            clientNeedsToBeUpdated = true;
                        }
                    }

                    // Set this BEFORE the if given that 
                    // we want the OLD value of `hook.event_type`
                    // in the condition
                    hook.event_type = eventType;
                }

                hook.save(function (err, hook) {
                    if (err) {
                        return cb(err);
                    }

                    if (clientNeedsToBeUpdated) {
                        client.save(function (err, client) {
                            if (err) {
                                return cb(err);
                            }

                            cb(null, hook);
                        });

                        return;
                    }

                    cb(null, hook);
                });
            }]
        }, function (err, results) {
            var hook = results && results.updateHook;

            if (err) {
                return next(err);
            }

            res.send(hook.toObject());
        });
    });
};