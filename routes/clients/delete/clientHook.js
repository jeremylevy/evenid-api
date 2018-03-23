var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var removeOauthHooks = require('../../../models/actions/removeOauthHooks');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/hooks/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app_developer'), function (req, res, next) {
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

            deleteHook: ['findClient', function (cb, results) {
                var client = results.findClient;
                var hook = client.hooks[0];

                removeOauthHooks([hook._id], 
                                 client._id,
                                 function (err, updatedClient) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedClient);
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