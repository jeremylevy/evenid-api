var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var OauthClientRegisteredUser = Schema({
    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        index: true,
        required: true
    },

    count: {
        type: Number,
        required: true
    },

    previous_count: {
        type: Number,
        required: true
    },

    at: {
        type: Date,
        index: true,
        required: true
    }
});

module.exports = OauthClientRegisteredUser;