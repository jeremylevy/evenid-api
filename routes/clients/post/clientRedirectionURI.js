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
                            + ')/redirection-uris$');

    app.post(uriReg, checkScope('app_developer'), function (req, res, next) {
        var absoluteURI = validator.trim(req.body.uri);
        var responseType = validator.trim(req.body.response_type);

        /* Make sure we have an empty array
           when we have empty `scope(_flags)` field. 
           Not an array equals to `['']` when splitted. */ 

        var scope = !req.body.scope 
                        ? [] 
                        : validator.trim(req.body.scope).split(' ');

        var scopeFlags = !req.body.scope_flags
                            ? []
                            : validator.trim(req.body.scope_flags)
                                       .split(' ');

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

                    if (client.redirection_uris.length 
                        >= config.EVENID_OAUTH_CLIENTS.MAX_ENTITIES.REDIRECTION_URIS) {
                    
                        return cb(new AccessDeniedError('You have reached the maximum number '
                                                        + 'of redirection uris allowed per client.'));
                    }

                    cb(null, client);
                });
            },

            createRedirectionURI: ['findClient', function (cb) {
                db.models.OauthRedirectionURI.create({
                    client: clientID,
                    uri: absoluteURI,
                    response_type: responseType,
                    scope: scope,
                    scope_flags: scopeFlags
                }, function (err, redirectionURI) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, redirectionURI);
                });
            }],

            attachToClient: ['createRedirectionURI', function (cb, results) {
                var client = results.findClient;
                var redirectionURI = results.createRedirectionURI;

                client.redirection_uris.push(redirectionURI._id);

                // Make sure client will be saved
                // event if redirection uris array is populated
                client.markModified('redirection_uris');

                client.save(function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, client);
                })
            }]
        }, function (err, results) {
            var redirectionURI = results && results.createRedirectionURI;

            if (err) {
                return next(err);
            }

            res.send(redirectionURI.toObject());
        });
    });
};