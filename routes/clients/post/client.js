var async = require('async');
var validator = require('validator');
var mongoose = require('mongoose');

var config = require('../../../config');

var db = require('../../../models');
var token = require('../../../libs/token');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    
    // Users can become developer by creating a client
    // So we must authorize `app` scope not only `app_developer` scope
    app.post('/clients', checkScope('app'), function (req, res, next) {
        var clientName = validator.trim(req.body.name);
        var clientDesc = validator.trim(req.body.description);
        var clientWebsite = validator.trim(req.body.website);
        var clientLogo = validator.trim(req.body.logo);

        var authorizeTestAccounts = (req.body.authorize_test_accounts === 'true');

        var facebookUsername = validator.trim(req.body.facebook_username);
        var twitterUsername = validator.trim(req.body.twitter_username);
        var instagramUsername = validator.trim(req.body.instagram_username);

        var accessToken = res.locals.accessToken;
        var user = res.locals.user;

        if (user.developer.clients.length 
            >= config.EVENID_USERS.MAX_ENTITIES.CLIENTS) {

            return next(new AccessDeniedError('You have reached the maximum number '
                                            + 'of clients allowed per developer.'));
        }

        async.auto({
            setUserAsDevIfNeeded: function (cb) {
                if (user.is_developer) {
                    return cb(null);
                }

                user.is_developer = true;

                user.save(function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    accessToken.authorization
                               .scope
                               .push('app_developer');

                    accessToken.authorization
                               .save(function (err, updatedAuthorization) {
                        
                        if (err) {
                            return cb(err);
                        }

                        cb(null);
                    });
                });
            },

            generateClientSecret: function (cb) {
                token(cb);
            },

            createClient: ['setUserAsDevIfNeeded', 
                           'generateClientSecret',
                           function (cb, results) {
                
                var clientSecret = results.generateClientSecret;

                db.models.OauthClient.create({
                    client_id: mongoose.Types.ObjectId(),
                    client_secret: clientSecret,

                    name: clientName,
                    description: clientDesc,
                    website: clientWebsite,
                    logo: clientLogo,

                    authorize_test_accounts: authorizeTestAccounts,

                    facebook_username: facebookUsername,
                    twitter_username: twitterUsername,
                    instagram_username: instagramUsername
                }, function (err, oauthClient) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, oauthClient);
                });
            }],

            attachClientToUser: ['createClient', function (cb, results) {
                var client = results.createClient;

                user.developer.clients.push(client._id);

                // Make sure user will be saved
                // even if developer's clients array is populated
                user.markModified('developer.clients');

                user.save(function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }]
        }, function (err, results) {
            var oauthClient = results && results.createClient;

            if (err) {
                return next(err);
            }

            res.send(oauthClient.toObject({
                hide: '_id __v client_secret redirection_uris hooks',
                // From logo ID to URL
                getters: true,
                // Call transform function
                transform: true
            }));
        });
    });
};