var util = require('util');
var mongoose = require('mongoose');

var config = require('../config');

var isEmpty = require('./validators/isEmpty');
var isValidUploadHash = require('./validators/isValidUploadHash');

var isValidAlpha2CountryCode = require('./validators/isValidAlpha2CountryCode');
var isValidTimezone = require('./validators/isValidTimezone');

var userCanUpdateField = require('./validators/userCanUpdateField');
var userCanUpdateIsDeveloperField = require('./validators/userCanUpdateIsDeveloperField');

var comparePassword = require('./methods/user/comparePassword');
var ownEntity = require('./methods/user/ownEntity');
var ownEmail = require('./methods/user/ownEmail');
var ownClient = require('./methods/user/ownClient');
var ownPhoneNumber = require('./methods/user/ownPhoneNumber');
var ownAddress = require('./methods/user/ownAddress');
var hasProfilPhoto = require('./methods/user/hasProfilPhoto');
var hasAuthorizedClient = require('./methods/user/hasAuthorizedClient');

var getGravatar = require('./properties/getters/user/virtuals/gravatar');
var getEmail = require('./properties/getters/user/virtuals/email');
var getFirstName = require('./properties/getters/user/firstName');
var getLastName = require('./properties/getters/user/lastName');
var getProfilPhoto = require('./properties/getters/user/profilPhoto');

var setProfilPhoto = require('./properties/setters/user/profilPhoto');

var populateGrantedAuthorizations = require('./middlewares/pre/validate/populateGrantedAuthorizations');

var findOauthEntitiesID = require('./middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('./middlewares/pre/save/sendNotificationToClients');
var updateOauthUserStatus = require('./middlewares/pre/save/updateOauthUserStatus');

var unsetHiddenProperties = require('./middlewares/pre/save/unsetHiddenProperties');
var unsetEmptyProperties = require('./middlewares/pre/save/user/unsetEmptyProperties');

var hashPassword = require('./middlewares/pre/save/user/hashPassword');

var grantedAuthorizationsProp = require('./properties/schemas/grantedAuthorizations')('users');

var Schema = mongoose.Schema;
var userSchema = {
    emails: [{
        type: Schema.Types.ObjectId,
        ref: 'Email',
        index: true
    }],

    password: {
        type: String,
        validate: [{
            validator: function (password) {
                return password.length >= config.EVENID_USERS.MAX_LENGTHS.PASSWORD;
            },
            msg: util.format('Your password must be at least %d characters.',
                             config.EVENID_USERS.MAX_LENGTHS.PASSWORD)
        }]
    },

    first_name: {
        type: String,
        validate: [
            {
                validator: userCanUpdateField('first_name'),
                msg: 'First name must be set.'
            }, 

            {
                validator: function (firstName) {
                    return isEmpty(firstName) 
                        || firstName.length <= config.EVENID_USERS.MAX_LENGTHS.FIRST_NAME;
                },
                msg: util.format('First name is too long. (Max %d characters.)',
                                 config.EVENID_USERS.MAX_LENGTHS.FIRST_NAME)
            }
        ]
    },

    last_name: {
        type: String,
        validate: [
            {
                validator: userCanUpdateField('last_name'),
                msg: 'Last name must be set.'
            },

            {
                validator: function (lastName) {
                    return isEmpty(lastName) 
                        || lastName.length <= config.EVENID_USERS.MAX_LENGTHS.LAST_NAME;
                },
                msg: util.format('Last name is too long. (Max %d characters.)',
                                 config.EVENID_USERS.MAX_LENGTHS.LAST_NAME)
            }
        ]
    },

    nickname: {
        type: String,
        index: {
            unique: true,
            // Allow multiple `null` values
            sparse: true
        },
        validate: [
            {
                validator: userCanUpdateField('nickname'),
                msg: 'Nickname must be set.'
            }, 

            {
                validator: function (nickname) {
                    return isEmpty(nickname) 
                        || nickname.length <= config.EVENID_USERS.MAX_LENGTHS.NICKNAME;
                },
                msg: util.format('Nickname is too long. (Max %d characters.)',
                                 config.EVENID_USERS.MAX_LENGTHS.NICKNAME)
            }
        ]
    },

    profil_photo: {
        // It's a hash
        type: String,
        // We don't need to check that profil photo
        // is set because profil photo
        // could be replaced by gravatar
        validate: [{
            validator: function (profilPhoto) {
                return isEmpty(profilPhoto) || isValidUploadHash(profilPhoto);
            },
            msg: 'Profil photo must be a valid upload hash.'
        }]
    },

    gender: {
        type: String,
        validate: [
            {
                validator: userCanUpdateField('gender'),
                msg: 'Gender must be set.'
            }, 

            {
                validator: function (gender) {
                    // If is empty, previous 
                    // validator will manage it
                    return isEmpty(gender)
                        || ['male', 'female'].indexOf(gender) !== -1;
                },
                msg: 'Gender is invalid.'
            }
        ]
    },

    date_of_birth: {
        type: Date,
        validate: [{
            validator: userCanUpdateField('date_of_birth'),
            msg: 'Date of birth must be set.'
        }]
    },

    place_of_birth: {
        type: String,
        validate: [
            {
                validator: userCanUpdateField('place_of_birth'),
                msg: 'Place of birth must be set.'
            }, 

            {
                validator: function (country) {
                    // If is empty, previous 
                    // validator will manage it
                    return isEmpty(country)
                        || isValidAlpha2CountryCode(country);
                },
                msg: 'Place of birth is invalid.'
            }
        ]
    },
    
    nationality: {
        type: String,
        validate: [
            {
                validator: userCanUpdateField('nationality'),
                msg: 'Nationality must be set.'
            }, 

            {
                validator: function (nationality) {
                    // If is empty, previous validator will manage it
                    return isEmpty(nationality)
                        || isValidAlpha2CountryCode(nationality);
                },
                msg: 'Nationality is invalid.'
            }
        ]
    },

    timezone: {
        type: String,
        validate: [
            {
                validator: userCanUpdateField('timezone'),
                msg: 'Timezone must be set.'
            }, 

            {
                validator: function (timezone) {
                    // If is empty, previous validator will manage it
                    return isEmpty(timezone)
                        || isValidTimezone(timezone);
                },
                msg: 'Timezone is invalid.'
            }
        ]
    },

    addresses: [{
        type: Schema.Types.ObjectId,
        ref: 'Address'
    }],

    phone_numbers: [{
        type: Schema.Types.ObjectId,
        ref: 'PhoneNumber'
    }],

    is_developer: {
        type: Boolean,
        default: false,
        validate: [{
            validator: userCanUpdateIsDeveloperField,
            msg: 'You must remove all clients before leaving the developer program.'
        }]
    },

    developer: {
        clients: [{
            type: Schema.Types.ObjectId,
            ref: 'OauthClient'
        }]
    },

    authorized_clients: [{
        type: Schema.Types.ObjectId,
        ref: 'OauthClient'
    }],

    is_test_account: {
        type: Boolean,
        default: false
    },

    // Used to never display 
    // captcha on automatic login
    // (registration, password recovering)
    auto_login: {
        type: Boolean,
        // On registration
        default: true
    }
};

var User = null;

// Append values
Object.keys(grantedAuthorizationsProp).forEach(function (k) {
    userSchema[k] = grantedAuthorizationsProp[k];
});

User = Schema(userSchema);

// Make sure to:
// - hide password when sending user
// - add virtuals
// - call getters
User.set('toObject', {
    hide: '_id __v password _granted_authorizations _oauth_entities_id',
    transform: true,
    virtuals: true,
    getters: true
});

User.path('first_name').get(getFirstName);
User.path('last_name').get(getLastName);

// Return full URL when we ask for profil photo
User.path('profil_photo').get(getProfilPhoto);
// Set profil photo ID when we set profil photo URL
User.path('profil_photo').set(setProfilPhoto);

User.virtual('email').get(getEmail);
User.virtual('gravatar').get(getGravatar);

// Populate `_granted_authorizations` field
User.pre('validate', populateGrantedAuthorizations('users'));

User.pre('save', findOauthEntitiesID('users'));
User.pre('save', sendNotificationToClients('users'));
User.pre('save', updateOauthUserStatus('users'));

// Remove properties like `_granted_authorizations`
// used in validators and middlewares
User.pre('save', unsetHiddenProperties('users'));

// Update from empty string to undefined.
// Since Mongoose version 4.0, if you set a field to 
// undefined after you already set it, validators 
// will no longer be run. Given that we need to check
// if user could remove field asked by client we must 
// set field to empty string instead of undefined, run
// validators, then set it to undefined.
User.pre('save', unsetEmptyProperties);

// Store hashed version of user's password before save
User.pre('save', hashPassword);

User.methods.comparePassword = comparePassword;

User.methods.own = ownEntity;
User.methods.ownEmail = ownEmail;
User.methods.ownClient = ownClient;
User.methods.hasProfilPhoto = hasProfilPhoto;
User.methods.hasAuthorizedClient = hasAuthorizedClient;
User.methods.ownAddress = ownAddress;
User.methods.ownPhoneNumber = ownPhoneNumber;

module.exports = User;