var mongoose = require('mongoose');

var config = require('../config');

var isEmpty = require('./validators/isEmpty');
var isValidOauthScope = require('./validators/isValidOauthScope')
                               (config.EVENID_OAUTH.VALID_USER_SCOPE);

var Email = require('./Email');
var PhoneNumber = require('./PhoneNumber');
var Address = require('./Address');

var getGravatar = require('./properties/getters/user/virtuals/gravatar');
var getEmail = require('./properties/getters/user/virtuals/email');
var getProfilPhoto = require('./properties/getters/user/profilPhoto');

var Schema = mongoose.Schema;

var TestUser = Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true
    },

    client: {
        type: Schema.Types.ObjectId, 
        ref: 'OauthClient',
        required: true
    },

    emails: [Email],

    first_name: String,
    last_name: String,
    
    nickname: {
        type: String,
        unique: true
    },

    profil_photo: String,

    gender: {
        type: String,
        enum: ['male', 'female']
    },

    date_of_birth: Date,

    place_of_birth: String,
    
    nationality: String,

    timezone: String,

    // Nesting Schemas only available 
    // for refs and arrays.
    mobile_phone_numbers: [PhoneNumber],
    landline_phone_numbers: [PhoneNumber],

    addresses: [Address],

    /* Fields used to manage oauth user status
       when client update redirection uri scope */

    sent_fields: {
        type: Array,
        default: [],
        validate: [{
            // Sent fields always match oauth scope
            validator: function (field) {
                // May be empty
                return isEmpty(field) || isValidOauthScope(field);
            },
            msg: 'Sent fields must only contain "scoppable" values.'
        }]
    },

    sent_entities: [{
        type: Schema.Types.ObjectId
    }]

    /* END */
});

// Gravatar URL is constructed from the email
TestUser.virtual('email')
        .get(getEmail);

// Called first, then always call the gravatar method
// (test accounts doesn't have profil photo)
TestUser.path('profil_photo')
        .get(getProfilPhoto);

// To send to client
TestUser.virtual('gravatar')
        .get(getGravatar);

module.exports = TestUser;