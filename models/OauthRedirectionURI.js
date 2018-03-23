var util = require('util');
var url = require('url');

var mongoose = require('mongoose');

var config = require('../config');

var Schema = mongoose.Schema;

var oauthRedirectionURIScopeProp = require('./properties/schemas/oauthRedirectionURIScope');
var oauthRedirectionURIScopeFlagsProp = require('./properties/schemas/oauthRedirectionURIScopeFlags');

var getNeedsClientSecret = require('./properties/getters/oauthRedirectionURI/virtuals/needsClientSecret');

var isEmpty = require('./validators/isEmpty');
var isValidOauthRedirectionURI = require('./validators/isValidOauthRedirectionURI');

var formatURI = require('./middlewares/pre/save/oauthRedirectionURI/formatURI');

var OauthRedirectionURI = Schema({
    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        required: true
    },

    uri: {
        type: String,
        required: true,
        validate: [
            {
                validator: isValidOauthRedirectionURI,
                msg: 'URI is invalid.'
            },

            {
                validator: function (URI) {
                    return isEmpty(URI) 
                        || URI.length <= config.EVENID_OAUTH_REDIRECTION_URIS
                                               .MAX_LENGTHS
                                               .URI;
                },
                msg: util.format('URI is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_REDIRECTION_URIS
                                       .MAX_LENGTHS
                                       .URI)
            }
        ]
    },

    response_type: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (responseType) {
                    var parsedURI = this.uri && url.parse(this.uri);

                    return !this.uri
                        || responseType !== 'token' 
                        || parsedURI.protocol === 'https:';
                },
                msg: 'Token response type is only available for "https://" URI.'
            },

            {
                validator: function (responseType) {
                    return config.EVENID_OAUTH
                                 .VALID_RESPONSE_TYPES
                                 .indexOf(responseType) !== -1;
                },
                msg: 'Response type is not an allowed value.'
            }
        ]
    },

    scope: oauthRedirectionURIScopeProp(config.EVENID_OAUTH.VALID_USER_SCOPE),
    scope_flags: oauthRedirectionURIScopeFlagsProp()
});

// Clients cannot have multiple redirection 
// uris with same `uri` field
OauthRedirectionURI.index({ 
    client: 1,
    uri: 1
}, {
    unique: true
});

// Make sure to:
// - add virtuals
OauthRedirectionURI.set('toObject', {
    hide: '_id __v',
    transform: true,
    virtuals: true
});

OauthRedirectionURI.virtual('needs_client_secret')
                   .get(getNeedsClientSecret);

OauthRedirectionURI.pre('save', formatURI);

module.exports = OauthRedirectionURI;