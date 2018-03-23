var mongoose = require('mongoose');
var async = require('async');

var config = require('../config');

var oauthRedirectionURIScopeProp = require('./properties/schemas/oauthRedirectionURIScope');
var oauthRedirectionURIScopeFlagsProp = require('./properties/schemas/oauthRedirectionURIScopeFlags');
var userAuthorizationEntitiesProp = require('./properties/schemas/userAuthorizationEntities');

var hasAppScope = require('./methods/oauthAuthorization/hasAppScope');

var Schema = mongoose.Schema;

// See the `UserAuthorization` model to learn why we have
// two entities for representing user authorization :)
var OauthAuthorization = Schema({
    // Code is not set if response_type is equal to token
    // or `password` or `client_credentials` grant type
    // login / registration (client is app)
    code: {
        value: {
            type: String,
            index: true
        },

        is_used: {
            type: Boolean,
            default: false
        },

        expires_at: {
            type: Date
        }
    },

    // Not set if `password` or `client_credentials` 
    // grant type login / registration (client is app)
    issued_to: {
        client: {
            type: Schema.Types.ObjectId, 
            ref: 'OauthClient',
            index: true
        }
    },

    // Not set if `client_credentials` 
    // grant type (on registration)
    issued_for: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    // ['authorization_code', 'token', 
    //  'password', 'client_credentials']
    type: {
        type: String,
        required: true,
        validate: [{
            validator: function (type) {
                return config.EVENID_OAUTH
                             .VALID_AUTHORIZATION_TYPES
                             .indexOf(type) !== -1;
            },
            msg: 'Type is not an allowed value.'
        }]
    },

    // Keep ref to authorized scope
    // Remember that dev can update 
    // redirection uris (and corresponding scope)
    // afterwards!
    scope: oauthRedirectionURIScopeProp(
            config.EVENID_OAUTH.VALID_USER_SCOPE.concat(
                config.EVENID_OAUTH.VALID_APP_SCOPE
            )),
    scope_flags: oauthRedirectionURIScopeFlagsProp(),

    // Remember that dev can update 
    // redirection uri afterwards !
    needs_client_secret: {
        type: Boolean,
        required: true,
        default: true
    },

    user: userAuthorizationEntitiesProp('oauthAuthorization')
});

OauthAuthorization.methods.hasAppScope = hasAppScope;

module.exports = OauthAuthorization;