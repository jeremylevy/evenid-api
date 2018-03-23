var async = require('async');
var assert = require('assert');

var config = require('../../../config');

var ClientEntityIDForUser = require('../../../libs/clientEntityIDForUser');

var findOauthEntitiesID = require('../../../models/actions/findOauthEntitiesID');

var areValidObjectIDs = require('../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var NotFoundError = require('../../../errors/types/NotFoundError');

// Used on index for each exposed API method.
// Used to match the client specific entity ID 
// with the real ID in the passed URL.
module.exports = function (req, res, next) {
    var clientSpecificUserID = req.params[0];

    var entity = req.params[1] || 'users';
    var clientSpecificEntityID = req.params[2] || clientSpecificUserID;
    
    var accessToken = res.locals.accessToken;
    var authorization = accessToken && accessToken.authorization;

    var userID = authorization && authorization.issued_for;
    var clientID = authorization && authorization.issued_to.client;

    var clientEntityIDForUser = null;

    assert.ok(areValidObjectIDs([clientSpecificUserID]),
              'argument `clientSpecificUserID` must be an ObjectID');

    assert.ok(config.EVENID_OAUTH
                    .ENTITIES_READY_FOR_UPDATE
                    .indexOf(entity) !== -1,
              'argument `entity` is invalid');

    assert.ok(areValidObjectIDs([clientSpecificEntityID]),
              'argument `clientSpecificEntityID` must be an ObjectID');

    if (!accessToken) {
        throw new Error('`accessToken` must be set as response locals '
                        + 'property before calling `findRealIDForClientSpecificID` '
                        + 'middleware');
    }

    // User on app
    if (authorization.hasAppScope()) {
        return next();
    }
    
    async.auto({
        findClientEntitiesIDForUser: function (cb) {
            // `{}`: find conditions
            findOauthEntitiesID({}, userID, clientID, function (err, oauthEntitiesID) {
                var realUserID = null;
                var realEntityID = null;

                if (err) {
                    return cb(err);
                }

                if (!oauthEntitiesID.length) {
                    return cb(new NotFoundError());
                }

                // Construct the function
                clientEntityIDForUser = ClientEntityIDForUser(oauthEntitiesID);

                realUserID = clientEntityIDForUser('users', 'real', clientSpecificUserID);

                if (!realUserID) {
                    return cb(new NotFoundError());
                }

                if (entity !== 'users') {
                    realEntityID = clientEntityIDForUser(entity, 'real', clientSpecificEntityID);

                    if (!realEntityID) {
                        return cb(new NotFoundError());
                    }
                }

                cb(null, {
                    realUserID: realUserID,
                    realEntityID: realEntityID
                });
            });
        }
    }, function (err, results) {
        var clientEntitiesIDForUser = results 
                                    && results.findClientEntitiesIDForUser;
        
        var realUserID = clientEntitiesIDForUser 
                            && clientEntitiesIDForUser.realUserID;
        var realEntityID = clientEntitiesIDForUser 
                            && clientEntitiesIDForUser.realEntityID;

        if (err) {
            return next(err);
        }

        res.locals.clientEntityIDForUser = clientEntityIDForUser;

        res.locals.realUserID = realUserID;
        res.locals.realEntityID = realEntityID;

        next();
    });
};