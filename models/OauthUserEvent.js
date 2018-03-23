var mongoose = require('mongoose');

var config = require('../config');

var Schema = mongoose.Schema;

var OauthUserEvent = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        index: true,
        required: true
    },

    type: {
        type: String,
        required: true,
        validate: [{
            validator: function (eventType) {
                return config.EVENID_OAUTH
                             .VALID_EVENT_TYPES_FOR_USER
                             .indexOf(eventType) !== -1;
            },
            msg: 'Event type is not an allowed value.'
        }]
    },

    created_at: {
        type: Date,
        index: true,
        required: true,
        default: Date.now
    }
});

module.exports = OauthUserEvent;