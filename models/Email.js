var util = require('util');

var mongoose = require('mongoose');
var validator = require('validator');

var config = require('../config');

var isEmpty = require('./validators/isEmpty');

var grantedAuthorizationsProp = require('./properties/schemas/grantedAuthorizations')('emails');
var populateGrantedAuthorizations = require('./middlewares/pre/validate/populateGrantedAuthorizations');

var findOauthEntitiesID = require('./middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('./middlewares/pre/save/sendNotificationToClients');

var updateOauthUserStatus = require('./middlewares/pre/save/updateOauthUserStatus');
var unsetHiddenProperties = require('./middlewares/pre/save/unsetHiddenProperties');

var Schema = mongoose.Schema;
var emailSchema = {
    address: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
        validate: [            
            {
                validator: function (email) {
                    return isEmpty(email)
                        || validator.isEmail(email);
                },
                msg: 'Email is invalid.'
            },

            {
                validator: function (email) {
                    return isEmpty(email) 
                        || email.length <= config.EVENID_EMAILS
                                                .MAX_LENGTHS
                                                .ADDRESS;
                },
                msg: util.format('Email is too long. (Max %d characters.)',
                                 config.EVENID_EMAILS
                                       .MAX_LENGTHS
                                       .ADDRESS)
            }
        ]
    },

    is_main_address: {
        type: Boolean,
        required: true,
        default: false
    },

    is_verified: {
        type: Boolean,
        required: true,
        default: false
    }
};

var Email = null;

// Append values
Object.keys(grantedAuthorizationsProp).forEach(function (k) {
    emailSchema[k] = grantedAuthorizationsProp[k];
});

Email = Schema(emailSchema);

Email.set('toObject', {
    transform: true,
    // Display `id` instead of `_id`
    // see transform method
    hide: '_id __v _granted_authorizations _oauth_entities_id user',
    replace: [['address'], ['email']]
});

// Populate `_granted_authorizations` field
// `emails`: entity name (must match user authorization entities fields)
Email.pre('validate', populateGrantedAuthorizations('emails'));

Email.pre('save', findOauthEntitiesID('emails'));
Email.pre('save', sendNotificationToClients('emails'));
Email.pre('save', updateOauthUserStatus('emails'));

Email.pre('save', unsetHiddenProperties('emails'));

module.exports = Email;