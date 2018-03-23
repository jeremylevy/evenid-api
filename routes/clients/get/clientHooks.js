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
                            + ')/hooks$');

    app.get(uriReg, checkScope('app_developer'), function (req, res, next) {
        var user = res.locals.user;

        var clientID = req.params[0];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findClient: function (cb) {
                var query = db.models.OauthClient.findById(clientID);

                query.populate({
                    path: 'hooks',
                    options: {
                        sort: {
                            _id: 1
                        }
                    }
                });

                query.exec(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client) {
                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            }
        }, function (err, results) {
            var client = results && results.findClient;

            if (err) {
                return next(err);
            }

            // Call toObject() to call transform method
            // on hooks before send
            res.send({
                hooks: client.toObject().hooks,
                eventTypes: config.EVENID_OAUTH
                                  .VALID_EVENT_TYPES_FOR_HOOK
            });
        });
    });
};