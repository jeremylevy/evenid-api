var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');
var InvalidRequestError = require('../../../errors/types/InvalidRequestError');

var checkScope = require('../../oauth/middlewares/checkScope');

// For security concerns (given that user password was sent)
// we break the "REST way" of API 
// by using POST method to get the client secret
module.exports = function (app, express) {
    var uriReg = new RegExp('^/clients/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/client-secret$');

    app.post(uriReg, checkScope('app_developer'), function (req, res, next) {
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
                        return cb(new InvalidRequestError({
                            user_password: userPassword 
                                ? 'Your password is invalid.'
                                : 'Your password must be set.'
                        }));
                    }

                    cb(null, ok);
                });
            },

            findClient: ['checkUserPassword', function (cb) {
                var select = 'client_secret';

                var query = db.models.OauthClient.findById(clientID, select, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client) {
                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            }]
        }, function (err, results) {
            var client = results && results.findClient;
            var clientAsObject = null;

            if (err) {
                return next(err);
            }

            clientAsObject = client.toObject();

            res.send(clientAsObject);
        });
    });
};