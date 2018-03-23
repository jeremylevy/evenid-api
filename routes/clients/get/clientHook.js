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

    app.get(uriReg, checkScope('app_developer'), function (req, res, next) {
        var user = res.locals.user;

        var clientID = req.params[0];
        var hookID = req.params[1];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findHook: function (cb) {
                // Make sure redirection URI belongs to client
                var query = db.models.OauthClient.findOne({
                    _id: clientID,
                    hooks: hookID
                });

                // Only populate asked redirection URI
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

                    cb(null, client.hooks[0]);
                });
            }
        }, function (err, results) {
            var hook = results && results.findHook;

            if (err) {
                return next(err);
            }

            res.send({
                hook: hook.toObject(),
                eventTypes: config.EVENID_OAUTH
                                  .VALID_EVENT_TYPES_FOR_HOOK
            });
        })
    });
};