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
                            + ')/redirection-uris/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.get(uriReg, checkScope('app_developer'), function (req, res, next) {
        var user = res.locals.user;

        var clientID = req.params[0];
        var redirectionURIID = req.params[1];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findRedirectionURI: function (cb) {
                // Make sure redirection URI belongs to client
                var query = db.models.OauthClient.findOne({
                    _id: clientID,
                    redirection_uris: redirectionURIID
                });

                // Only populate asked redirection URI
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

                    cb(null, client.redirection_uris[0]);
                });
            }
        }, function (err, results) {
            var redirectionURI = results && results.findRedirectionURI;

            if (err) {
                return next(err);
            }

            res.send(redirectionURI.toObject());
        });
    });
};