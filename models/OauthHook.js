var mongoose = require('mongoose');
var validator = require('validator');

var config = require('../config');

var oauthHookURL = require('./properties/schemas/oauthHookURL');

var isValidWebsiteURL = require('./validators/isValidWebsiteURL');

var Schema = mongoose.Schema;

var OauthHook = Schema({
    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        required: true
    },

    url: oauthHookURL('oauthHook'),

    event_type: {
        type: String,
        required: true,
        validate: [{
            validator: function (eventType) {
                return config.EVENID_OAUTH
                             .VALID_EVENT_TYPES_FOR_HOOK
                             .indexOf(eventType) !== -1;
            },
            msg: 'Event type is not an allowed value.'
        }]
    }
});

// One url per event type per client
OauthHook.index({
    client: 1,
    event_type: 1
}, {
    unique: true
});

module.exports = OauthHook;