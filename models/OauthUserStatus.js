var mongoose = require('mongoose');

var config = require('../config');

var isEmpty = require('./validators/isEmpty');

var isValidOauthScope = require('./validators/isValidOauthScope')
                               (config.EVENID_OAUTH.VALID_USER_SCOPE);

var Schema = mongoose.Schema;

var OauthUserStatus = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        required: true
    },

    status: {
        type: String,
        required: true,
        validate: [{
            validator: function (userStatus) {
                return config.EVENID_OAUTH
                             .VALID_USER_STATUS
                             .indexOf(userStatus) !== -1;
            },
            msg: 'Status is not an allowed value.'
        }]
    },

    updated_fields: {
        type: Array,
        default: [],
        validate: [{
            // Updated user fields always match oauth scope
            validator: function (field) {
                // May be empty
                return isEmpty(field) || isValidOauthScope(field);
            },
            msg: 'Updated fields must only contain "scoppable" values.'
        }]
    },

    updated_emails: [{
        id: {
            type: Schema.Types.ObjectId,
            ref: 'Email'
        },

        status: {
            type: String,
            enum: config.EVENID_OAUTH
                        .VALID_ENTITY_UPDATE_STATUS
        },

        updated_fields: {
            type: Array,
            default: []
        }
    }],

    updated_phone_numbers: [{
        id: {
            type: Schema.Types.ObjectId,
            ref: 'PhoneNumber'
        },

        status: {
            type: String,
            enum: config.EVENID_OAUTH
                        .VALID_ENTITY_UPDATE_STATUS
        },

        updated_fields: {
            type: Array,
            default: []
        }
    }],

    updated_addresses: [{
        id: {
            type: Schema.Types.ObjectId,
            ref: 'Address'
        },

        status: {
            type: String,
            enum: config.EVENID_OAUTH
                        .VALID_ENTITY_UPDATE_STATUS
        },

        updated_fields: {
            type: Array,
            default: []
        }
    }],

    use_test_account: {
        type: Boolean,
        required: true,
        default: false
    }
});

// One document per user for client
OauthUserStatus.index({
    user: 1, 
    client: 1
}, {
    unique: true
});

module.exports = OauthUserStatus;