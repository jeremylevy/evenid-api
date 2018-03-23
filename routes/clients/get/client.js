var async = require('async');

var config = require('../../../config');

var db = require('../../../models');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.get(uriReg, checkScope('app_developer'), function (req, res, next) {
        var user = res.locals.user;

        var clientID = req.params[0];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findClient: function (cb) {
                var select = '-client_secret -update_notification_handler -redirection_uris -hooks -statistics';

                var query = db.models
                              .OauthClient
                              .findById(clientID, select, function (err, client) {
                    
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
            var clientAsObject = null;

            if (err) {
                return next(err);
            }

            clientAsObject = client.toObject();

            // Remove subdocument 
            // (`{statistics: {registered_users: undefined}}`)
            delete clientAsObject.statistics;

            res.send(clientAsObject);
        });
    });
};