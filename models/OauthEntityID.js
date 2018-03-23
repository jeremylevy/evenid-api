var mongoose = require('mongoose');

var config = require('../config');

var Schema = mongoose.Schema;

var OauthEntityID = Schema({
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

    fake_id: {
        type: Schema.Types.ObjectId,
        required: true
    },

    real_id: {
        type: Schema.Types.ObjectId,
        required: true
    },

    // May be set to [entity]
    // or 
    // when user has chosen a mobile/landline phone number 
    // when client ask for phone number without specific type
    // so it has transparently authorized `mobile/landline_phone_number`
    // scope flags -> use same id for unknown and mobile/landline phone
    entities: {
        type: Array,
        required: true,
        validate: [{
            validator: function (entities) {
                var isValid = true;

                // Let the required 
                // validator do their job
                if (!entities) {
                    return false;
                }

                entities.forEach(function (entity) {
                    if (config.EVENID_OAUTH
                              .VALID_ENTITY_ID_TYPES.indexOf(entity) === -1) {
                        
                        isValid = false;
                    }
                });

                return isValid;
            },
            msg: 'Entities contains invalid values.'
        }]
    },

    use_test_account: {
        type: Boolean,
        required: true,
        default: false
    }
});

// One ID per entity per user for client
OauthEntityID.index({
    user: 1, 
    client: 1,
    real_id: 1
}, {
    unique: true
});

module.exports = OauthEntityID;