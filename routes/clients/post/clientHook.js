var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var isUniqueIndexError = require('../../../models/validators/isUniqueIndexError');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/hooks$');

    app.post(uriReg, checkScope('app_developer'), function (req, res, next) {
        var URL = validator.trim(req.body.url);
        var eventType = validator.trim(req.body.event_type);

        var user = res.locals.user;
        
        var clientID = req.params[0];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findClient: function (cb) {
                db.models.OauthClient.findById(clientID, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client) {
                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            },

            createHook: ['findClient', function (cb) {
                db.models.OauthHook.create({
                    client: clientID,
                    url: URL,
                    event_type: eventType
                }, function (err, hook) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, hook);
                });
            }],

            attachToClient: ['createHook', function (cb, results) {
                var client = results.findClient;
                var hook = results.createHook;

                if (eventType === 'USER_DID_UPDATE_PERSONAL_INFORMATION') {
                    client.update_notification_handler = hook.url;
                }

                client.hooks.push(hook._id);

                // Make sure client will be saved
                // event if hooks array is populated
                client.markModified('hooks');

                client.save(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                });
            }]
        }, function (err, results) {
            var hook = results && results.createHook;

            if (err) {
                return next(err);
            }

            res.send(hook.toObject());
        });
    });
};