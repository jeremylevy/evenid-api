var mongoose = require('mongoose');

var Schema = mongoose.Schema;

var UserResetPasswordRequest = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true
    },

    email: {
        type: Schema.Types.ObjectId,
        ref: 'Email',
        required: true
    },

    code: {
        type: String,
        required: true,
        unique: true
    },

    expires_at: {
        type: Date,
        required: true
    },

    created_at: {
        type: Date,
        required: true,
        default: Date.now
    }
});

module.exports = UserResetPasswordRequest;