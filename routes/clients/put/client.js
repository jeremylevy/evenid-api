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
                            + ')$');
    
    app.put(uriReg, checkScope('app_developer'), function (req, res, next) {
        var clientName = !Type.is(req.body.name, undefined)
                            ? validator.trim(req.body.name) 
                            : undefined;

        var clientDesc = !Type.is(req.body.description, undefined)
                            ? validator.trim(req.body.description)
                            : undefined;

        var clientWebsite = !Type.is(req.body.website, undefined)
                                ? validator.trim(req.body.website)
                                : undefined;

        var clientLogo = !Type.is(req.body.logo, undefined)
                            ? validator.trim(req.body.logo)
                            : undefined;

        var authorizeTestAccounts = !Type.is(req.body.authorize_test_accounts, undefined)
                                     ? req.body.authorize_test_accounts === 'true'
                                     : undefined;

        var facebookUsername = !Type.is(req.body.facebook_username, undefined)
                                    ? validator.trim(req.body.facebook_username)
                                    : undefined;

        var twitterUsername = !Type.is(req.body.twitter_username, undefined)
                                ? validator.trim(req.body.twitter_username)
                                : undefined;

        var instagramUsername = !Type.is(req.body.instagram_username, undefined)
                                    ? validator.trim(req.body.instagram_username)
                                    : undefined;

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

            updateClient: ['findClient', function (cb, results) {
                var client = results.findClient;

                if (!Type.is(clientName, undefined)) {
                    client.name = clientName;
                }

                if (!Type.is(clientDesc, undefined)) {
                    client.description = clientDesc;
                }

                if (!Type.is(clientWebsite, undefined)) {
                    client.website = clientWebsite;
                }

                if (!Type.is(clientLogo, undefined)) {
                    client.logo = clientLogo;
                }

                if (!Type.is(authorizeTestAccounts, undefined)) {
                    client.authorize_test_accounts = authorizeTestAccounts;
                }

                if (!Type.is(facebookUsername, undefined)) {
                    client.facebook_username = facebookUsername;
                }

                if (!Type.is(twitterUsername, undefined)) {
                    client.twitter_username = twitterUsername;
                }

                if (!Type.is(instagramUsername, undefined)) {
                    client.instagram_username = instagramUsername;
                }

                client.save(function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            }]
        }, function (err, results) {
            var updatedClient = results && results.updateClient;

            if (err) {
                return next(err);
            }

            res.send(updatedClient.toObject({
                hide: '_id __v client_secret redirection_uris hooks',
                // From logo ID to URL
                getters: true,
                // Call transform function
                transform: true
            }));
        });
    });
};