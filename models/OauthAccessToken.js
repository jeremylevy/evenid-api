var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var OauthAccessToken = Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },

    issued_at: {
        type: Date,
        required: true,
        default: Date.now
    },

    expires_at: {
        type: Date,
        required: true
    },

    authorization: {
        type: Schema.Types.ObjectId,
        ref: 'OauthAuthorization',
        index: true,
        required: true
    },

    refresh_token: {
        type: String,
        required: true,
        unique: true
    },

    /* Set when user was logged by client
       (ie: not logged using the app).
       They were used during oauth authorization
       to immediatly redirect user to client after login
       if user was loged by client and client only ask 
       for user's email.
    */

    logged_by_client: {
        type: Schema.Types.ObjectId,
        ref: 'OauthClient'
    },

    logged_with_email: {
        type: Schema.Types.ObjectId,
        ref: 'Email'
    }
});

module.exports = OauthAccessToken;