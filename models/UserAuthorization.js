var mongoose = require('mongoose');

var config = require('../config');

var oauthRedirectionURIScopeProp = require('./properties/schemas/oauthRedirectionURIScope');
var oauthRedirectionURIScopeFlagsProp = require('./properties/schemas/oauthRedirectionURIScopeFlags');
var userAuthorizationEntitiesProp = require('./properties/schemas/userAuthorizationEntities');

var Schema = mongoose.Schema;

// Represents everything the user 
// has allowed for one client
// Oauth authorizations are bound to 
// an access token and may represent 
// narrower scope (if client has updated 
// redirection uri scope afterwards, for example)
// Used by convenience to avoid iterating 
// all authorizations and removing duplicates
var UserAuthorization = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        required: true
    },

    scope: oauthRedirectionURIScopeProp(config.EVENID_OAUTH.VALID_USER_SCOPE),
    scope_flags: oauthRedirectionURIScopeFlagsProp(),

    entities: userAuthorizationEntitiesProp('userAuthorization'),

    address_to_be_selected_first: {
        type: Schema.Types.ObjectId,
        ref: 'Address'
    }
});

// One document per user per client
UserAuthorization.index({
    user: 1, 
    client: 1
}, {
    unique: true
});

module.exports = UserAuthorization;