var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var OauthNotification = Schema({
    user: {
        type: Schema.Types.ObjectId,
        // It's not the real user ID
        // but client specific ID
        // ref: 'User',
        required: true
    },

    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        required: true
    },

    pending_notifications: [{
        notification: {
            type: String
        }
    }],

    processed_at: {
        type: Date,
        required: true,
        default: new Date(0)
    }
});

// One document per user for client
OauthNotification.index({
    user: 1, 
    client: 1
}, {
    unique: true
});

module.exports = OauthNotification;