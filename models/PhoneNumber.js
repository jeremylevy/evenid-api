var mongoose = require('mongoose');

var getInternationalPhoneNumber = require('./properties/getters/phoneNumber/virtuals/internationalNumber');
var getPhoneNumber = require('./properties/getters/phoneNumber/number');

var setOldPhoneType = require('./properties/setters/phoneNumber/phoneType');

var isValidPhoneNumberForRegion = require('./validators/isValidPhoneNumberForRegion');
var isValidPhoneTypeForNumber = require('./validators/isValidPhoneTypeForNumber');

var grantedAuthorizationsProp = require('./properties/schemas/grantedAuthorizations')
                                       ('phone_numbers');

var setPhoneType = require('./middlewares/pre/validate/phoneNumber/setPhoneType');

var populateGrantedAuthorizations = require('./middlewares/pre/validate/populateGrantedAuthorizations');

var findOauthEntitiesID = require('./middlewares/pre/save/findOauthEntitiesID');

var sendNotificationToClients = require('./middlewares/pre/save/sendNotificationToClients');
var updateOauthUserStatus = require('./middlewares/pre/save/updateOauthUserStatus');

var unsetHiddenProperties = require('./middlewares/pre/save/unsetHiddenProperties');
var assertPhoneTypeMayBeUpdated = require('./middlewares/pre/save/phoneNumber/assertPhoneTypeMayBeUpdated');

var Schema = mongoose.Schema;
var phoneNumberSchema = {
    number: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (number) {
                    return isValidPhoneNumberForRegion(number, this.country);
                },
                msg: 'Phone number is invalid for specified country.'
            },
            
            {
                validator: function (number) {
                    return isValidPhoneTypeForNumber.call(this, number);
                },
                msg: 'Phone number is invalid.'
            }
        ]
    },

    country: {
        type: String,
        required: true
    },
    
    phone_type: {
        type: String,
        enum: ['unknown', 'landline', 'mobile'],
        required: true,
        default: 'unknown'
    },

    // Used by `assertPhoneTypeMayBeUpdated`
    // middleware to check if user can update
    // phone type for a phonen number asked by clients.
    // Never inserted.
    // Deleted by `unsetHiddenProperties` middleware.
    _old_phone_type: {
        type: String
    }
};

var PhoneNumber = null;

// Append values
Object.keys(grantedAuthorizationsProp).forEach(function (k) {
    phoneNumberSchema[k] = grantedAuthorizationsProp[k];
});

PhoneNumber = Schema(phoneNumberSchema);

// Make sure to call getters
// when calling `toObject` method
PhoneNumber.set('toObject', {
    hide: '_id __v _granted_authorizations _oauth_entities_id _old_phone_type user',
    transform: true,
    getters: true,
    virtuals: true
});

// Returns number in user country format
PhoneNumber.path('number')
           .get(getPhoneNumber);

// Save old phone type when it was updated
PhoneNumber.path('phone_type')
           .set(setOldPhoneType);

PhoneNumber.virtual('international_number')
           .get(getInternationalPhoneNumber);

// Try to guess phone type if not set
PhoneNumber.pre('validate', setPhoneType);

// Populate `_granted_authorizations` field
// `phone_numbers`: entity name 
// (must match user authorization entities fields)
PhoneNumber.pre('validate', populateGrantedAuthorizations('phone_numbers'));

// Order matter, here. Given that `assertPhoneTypeMayBeUpdated`
// may throw error or update phone type.
PhoneNumber.pre('save', assertPhoneTypeMayBeUpdated);

PhoneNumber.pre('save', findOauthEntitiesID('phone_numbers'));
PhoneNumber.pre('save', sendNotificationToClients('phone_numbers'));
PhoneNumber.pre('save', updateOauthUserStatus('phone_numbers'));

PhoneNumber.pre('save', unsetHiddenProperties('phone_numbers'));

module.exports = PhoneNumber;