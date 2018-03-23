var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var OauthClientTestAccount = Schema({
    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        index: true,
        required: true
    },

    count: {
        registered: {
            type: Number,
            required: true
        },

        converted: {
            type: Number,
            required: true
        }
    },

    previous_count: {
        registered: {
            type: Number,
            required: true
        },

        converted: {
            type: Number,
            required: true
        }
    },

    at: {
        type: Date,
        index: true,
        required: true
    }
});

module.exports = OauthClientTestAccount;