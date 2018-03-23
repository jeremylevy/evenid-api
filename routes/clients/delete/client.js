var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var removeOauthClient = require('../../../models/actions/removeOauthClient');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var checkScope = require('../../oauth/middlewares/checkScope');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.delete(uriReg, checkScope('app_developer'), function (req, res, next) {
        var userPassword = validator.trim(req.body.user_password);

        var user = res.locals.user;

        var clientID = req.params[0];

        // Check that user own client
        if (!user.ownClient(clientID)) {
            return next(new AccessDeniedError());
        }
        
        async.auto({
            checkUserPassword: function (cb, results) {
                user.comparePassword(userPassword, function (err, ok) {
                    if (err) {
                        return cb(err);
                    }

                    if (!ok) {
                        cb(new InvalidRequestError({
                            user_password: userPassword 
                                ? 'Your password is invalid.' 
                                : 'Your password must be set.'
                        }));

                        return;
                    }

                    cb(null, ok);
                });
            },

            findClient: ['checkUserPassword', function (cb) {
                db.models.OauthClient.findById(clientID, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client) {
                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            }],

            removeClient: ['findClient', function (cb, results) {
                var client = results.findClient;

                removeOauthClient(client, user._id, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
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