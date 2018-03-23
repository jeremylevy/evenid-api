var util = require('util');

var mongoose = require('mongoose');
var async = require('async');

var config = require('../config');

var oauthHookURL = require('./properties/schemas/oauthHookURL');

var isEmpty = require('./validators/isEmpty');
var isValidWebsiteURL = require('./validators/isValidWebsiteURL');
var isValidUploadHash = require('./validators/isValidUploadHash');

var getLogo = require('./properties/getters/oauthClient/logo');
var setLogo = require('./properties/setters/oauthClient/logo');

var Schema = mongoose.Schema;

var OauthClient = Schema({
    client_id: {
        type: Schema.Types.ObjectId,
        unique: true,
        required: true
    },

    client_secret: {
        type: String,
        required: true
    },

    name: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (name) {
                    return isEmpty(name) 
                        || name.length <= config.EVENID_OAUTH_CLIENTS
                                                .MAX_LENGTHS
                                                .NAME;
                },
                msg: util.format('Name is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_CLIENTS
                                       .MAX_LENGTHS
                                       .NAME)
            }
        ]
    },

    logo: {
        // It's a hash
        type: String,
        required: true,
        validate: [{
            validator: function (logo) {
                return isValidUploadHash(logo);
            },
            msg: 'Logo must be a valid upload hash.'
        }]
    },

    description: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (description) {
                    return isEmpty(description) 
                        || description.length <= config.EVENID_OAUTH_CLIENTS
                                                       .MAX_LENGTHS
                                                       .DESCRIPTION;
                },
                msg: util.format('Description is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_CLIENTS
                                       .MAX_LENGTHS
                                       .DESCRIPTION)
            }
        ]
    },

    website: {
        type: String,
        required: true,
        validate: [
            {
                validator: isValidWebsiteURL,
                msg: 'Your website URL is not valid.'
            },

            {
                validator: function (website) {
                    return isEmpty(website) 
                        || website.length <= config.EVENID_OAUTH_CLIENTS
                                                   .MAX_LENGTHS
                                                   .WEBSITE;
                },
                msg: util.format('Website is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_CLIENTS
                                       .MAX_LENGTHS
                                       .WEBSITE)
            }
        ]
    },

    authorize_test_accounts: {
        type: Boolean,
        required: true,
        default: true
    },

    update_notification_handler: oauthHookURL('oauthClient'),

    facebook_username: {
        type: String,
        validate: [
            {
                validator: function (facebookUsername) {
                    return isEmpty(facebookUsername) 
                        || facebookUsername.length <= config.EVENID_OAUTH_CLIENTS
                                                            .MAX_LENGTHS
                                                            .FACEBOOK_USERNAME;
                },
                msg: util.format('Facebook username is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_CLIENTS
                                       .MAX_LENGTHS
                                       .FACEBOOK_USERNAME)
            }
        ]
    },

    twitter_username: {
        type: String,
        validate: [
            {
                validator: function (twitterUsername) {
                    return isEmpty(twitterUsername) 
                        || twitterUsername.length <= config.EVENID_OAUTH_CLIENTS
                                                           .MAX_LENGTHS
                                                           .TWITTER_USERNAME;
                },
                msg: util.format('Twitter username is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_CLIENTS
                                       .MAX_LENGTHS
                                       .TWITTER_USERNAME)
            }
        ]
    },

    instagram_username: {
        type: String,
        validate: [
            {
                validator: function (instagramUsername) {
                    return isEmpty(instagramUsername) 
                        || instagramUsername.length <= config.EVENID_OAUTH_CLIENTS
                                                             .MAX_LENGTHS
                                                             .INSTAGRAM_USERNAME;
                },
                msg: util.format('Instagram username is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_CLIENTS
                                       .MAX_LENGTHS
                                       .INSTAGRAM_USERNAME)
            }
        ]
    },

    redirection_uris: [{
        type: Schema.Types.ObjectId,
        ref: 'OauthRedirectionURI'
    }],

    hooks: [{
        type: Schema.Types.ObjectId,
        ref: 'OauthHook'
    }],

    statistics: {
        registered_users: {
            type: Number,
            default: 0
        },

        test_accounts: {
            registered: {
                type: Number,
                default: 0
            },

            converted: {
                type: Number,
                default: 0
            }
        }
    }
});

OauthClient.set('toObject', {
    hide: '_id __v',
    transform: true,
    getters: true
});

// Return full URL when we ask for logo
OauthClient.path('logo').get(getLogo);
// Set logo ID when we set logo URL
OauthClient.path('logo').set(setLogo);

module.exports = OauthClient;