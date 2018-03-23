var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var removeOauthRedirectionURIs = require('../../../models/actions/removeOauthRedirectionURIs');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/redirection-uris/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app_developer'), function (req, res, next) {
        var user = res.locals.user;

        var clientID = req.params[0];
        var redirectionURIID = req.params[1];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            // Make sure redirect URI 
            // belongs to client
            findClient: function (cb) {
                var query = db.models.OauthClient.findOne({
                    _id: clientID,
                    redirection_uris: redirectionURIID
                });

                query.populate({
                    path: 'redirection_uris',
                    match: {
                        _id: redirectionURIID
                    }
                });

                query.exec(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client
                        || !client.redirection_uris.length) {

                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            },

            deleteRedirectionURI: ['findClient', function (cb, results) {
                var client = results.findClient;
                var redirectionURI = client.redirection_uris[0];

                removeOauthRedirectionURIs([redirectionURI._id], 
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