var insertOauthEntitiesID = require('../../../../models/actions/insertOauthEntitiesID');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var authorizedEntities = res.locals.authorizedEntities;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `insertOauthEntitiesID` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `insertOauthEntitiesID` '
                        + 'middleware');
    }

    if (!authorizedEntities) {
        throw new Error('`authorizedEntities` must be set as response locals '
                        + 'property before calling `insertOauthEntitiesID` '
                        + 'middleware');
    }

    // We must also add an entity ID for the user
    if (!authorizedEntities.users 
        || !authorizedEntities.users.length) {

        authorizedEntities.users = [user.id];
    }

    // Only insert if not exists
    insertOauthEntitiesID(authorizedEntities, user.id, 
                          client.id, function (err) {
        
        if (err) {
            return next(err);
        }

        next();
    });
};