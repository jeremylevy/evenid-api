var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var findUserAuthorizations = require('../../../models/actions/findUserAuthorizations');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/authorizations$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var entity = validator.trim(req.query.entity);
        var entityID = validator.trim(req.query.entity_id);

        var user = res.locals.user;
        var userID = req.params[0];

        // Check that user is access token user
        if (user.id !== userID) {
            return next(new AccessDeniedError());
        }

        async.auto({
            findAuthorizations: function (cb) {
                findUserAuthorizations.call({
                    usedTo: 'displayInViews'
                }, entity, entityID, user._id, function (err, authorizations) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, authorizations);
                });
            }
        }, function (err, results) {
            var authorizations = results && results.findAuthorizations;
            var authorizationsAsRawObj = [];

            if (err) {
                return next(err);
            }

            authorizations.forEach(function (authorization) {
                authorizationsAsRawObj.push(authorization.toObject());
            });

            res.send(authorizationsAsRawObj);
        });
    });
};