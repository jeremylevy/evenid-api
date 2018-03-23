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
                            + ')/redirection-uris/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.put(uriReg, checkScope('app_developer'), function (req, res, next) {
        var absoluteURI = !Type.is(req.body.uri, undefined) 
                            ? validator.trim(req.body.uri)
                            : undefined;

        var responseType = !Type.is(req.body.response_type, undefined) 
                            ? validator.trim(req.body.response_type)
                            : undefined;

        /* Make sure we have an empty array
           when we have empty `scope(_flags)` field. 
           Not an array equals to `['']` when splitted. */ 

        var scope = !Type.is(req.body.scope, undefined) 
                        ? (req.body.scope === '' 
                           ? [] 
                           : validator.trim(req.body.scope).split(' '))
                        : undefined;

        var scopeFlags = !Type.is(req.body.scope_flags, undefined) 
                            ? (req.body.scope_flags === '' 
                                ? [] 
                                : validator.trim(req.body.scope_flags).split(' '))
                            : undefined;
        
        var user = res.locals.user;
        
        var clientID = req.params[0];
        var redirectionURIID = req.params[1];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findClient: function (cb) {
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

                    cb(null, client);
                });
            },

            updateRedirectionURI: ['findClient', function (cb, results) {
                var client = results.findClient;
                var redirectionURI = client.redirection_uris[0];
                
                if (!Type.is(absoluteURI, undefined)) {
                    redirectionURI.uri = absoluteURI;
                }

                if (!Type.is(responseType, undefined)) {
                    redirectionURI.response_type = responseType;
                }

                if (!Type.is(scope, undefined)) {
                    redirectionURI.scope = scope;
                }

                if (!Type.is(scopeFlags, undefined)) {
                    redirectionURI.scope_flags = scopeFlags;
                }

                redirectionURI.save(function (err, redirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, redirectionURI);
                });
            }]
        }, function (err, results) {
            var redirectionURI = results && results.updateRedirectionURI;

            if (err) {
                return next(err);
            }

            res.send(redirectionURI.toObject());
        });
    });
};