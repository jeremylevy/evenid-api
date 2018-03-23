var util = require('util');
var mongoose = require('mongoose');

var config = require('../config');

var isEmpty = require('./validators/isEmpty');
var isValidAlpha2CountryCode = require('./validators/isValidAlpha2CountryCode');

var grantedAuthorizationsProp = require('./properties/schemas/grantedAuthorizations')
                                       ('addresses');

var populateGrantedAuthorizations = require('./middlewares/pre/validate/populateGrantedAuthorizations');

var authorizeAccessToEntity = require('./middlewares/pre/save/authorizeAccessToEntity');

var findOauthEntitiesID = require('./middlewares/pre/save/findOauthEntitiesID');
var sendNotificationToClients = require('./middlewares/pre/save/sendNotificationToClients');

var updateOauthUserStatus = require('./middlewares/pre/save/updateOauthUserStatus');
var unsetHiddenProperties = require('./middlewares/pre/save/unsetHiddenProperties');

var Schema = mongoose.Schema;
var addressSchema = {
    full_name: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (fullName) {
                    return !isEmpty(fullName);
                },
                msg: 'Full name must be set.'
            }, 

            {
                validator: function (fullName) {
                    return fullName.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.FULL_NAME;
                },
                msg: util.format('Full name is too long. (Max %d characters.)',
                                 config.EVENID_ADDRESSES.MAX_LENGTHS.FULL_NAME)
            }
        ]
    },

    address_line_1: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (addressLine1) {
                    return !isEmpty(addressLine1);
                },
                msg: 'Address line 1 must be set.'
            }, 

            {
                validator: function (addressLine1) {
                    return addressLine1.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_1;
                },
                msg: util.format('Address line 1 is too long. (Max %d characters.)',
                                 config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_1)
            }
        ]
    },

    address_line_2: {
        type: String,
        validate: [{
            validator: function (addressLine2) {
                return !addressLine2 
                    || addressLine2.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_2;
            },
            msg: util.format('Address line 2 is too long. (Max %d characters.)',
                             config.EVENID_ADDRESSES.MAX_LENGTHS.ADDRESS_LINE_2)
        }]
    },

    access_code: {
        type: String,
        validate: [{
            validator: function (accessCode) {
                return !accessCode 
                    || accessCode.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.ACCESS_CODE;
            },
            msg: util.format('Access code is too long. (Max %d characters.)',
                             config.EVENID_ADDRESSES.MAX_LENGTHS.ACCESS_CODE)
        }]
    },

    city: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (city) {
                    return !isEmpty(city);
                },
                msg: 'City must be set.'
            },

            {
                validator: function (city) {
                    return city.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.CITY;
                },
                msg: util.format('City is too long. (Max %d characters.)',
                                 config.EVENID_ADDRESSES.MAX_LENGTHS.CITY)
            }
        ]
    },

    state: {
        type: String,
        validate: [{
            validator: function (state) {
                return !state 
                    || state.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.STATE;
            },
            msg: util.format('State is too long. (Max %d characters.)',
                             config.EVENID_ADDRESSES.MAX_LENGTHS.STATE)
        }]
    },

    postal_code: {
        type: String,
        required: true,
        validate: [
            {
                validator: function (postalCode) {
                    return !isEmpty(postalCode);
                },
                msg: 'Postal code must be set.'
            },

            {
                validator: function (postalCode) {
                    return postalCode.length <= config.EVENID_ADDRESSES.MAX_LENGTHS.POSTAL_CODE;
                },
                msg: util.format('Postal code is too long. (Max %d characters.)',
                                 config.EVENID_ADDRESSES.MAX_LENGTHS.POSTAL_CODE)
            }
        ]
    },

    country: {
        type: String, 
        required: true,
        validate: [
            {
                validator: function (country) {
                    return !isEmpty(country);
                },
                msg: 'Country must be set.'
            },
            
            {
                validator: function (country) {
                    return isValidAlpha2CountryCode(country);
                },
                msg: 'Country is invalid.'
            }
        ]
    },

    address_type: {
        type: String,
        required: true,
        enum: ['residential', 'commercial']
    }
};

var Address = null;

// Append values
Object.keys(grantedAuthorizationsProp).forEach(function (k) {
    addressSchema[k] = grantedAuthorizationsProp[k];
});

Address = Schema(addressSchema);

// Make sure to hide added properties
Address.set('toObject', {
    transform: true,
    hide: '_id __v _granted_authorizations _oauth_entities_id user'
});

// Populate `_granted_authorizations` field
// `addresses`: entity name (must match user 
// authorization entities fields)
Address.pre('validate', populateGrantedAuthorizations('addresses'));

Address.pre('save', authorizeAccessToEntity('addresses'));

Address.pre('save', findOauthEntitiesID('addresses'));
Address.pre('save', sendNotificationToClients('addresses'));

Address.pre('save', updateOauthUserStatus('addresses'));
Address.pre('save', unsetHiddenProperties('addresses'));

Address.pre('remove', populateGrantedAuthorizations.call({
    eventName: 'remove'
}, 'addresses'));

Address.pre('remove', findOauthEntitiesID.call({
    eventName: 'remove'
}, 'addresses'));

Address.pre('remove', sendNotificationToClients.call({
    eventName: 'remove'
}, 'addresses'));

Address.pre('remove', updateOauthUserStatus.call({
    eventName: 'remove'
}, 'addresses'));

module.exports = Address;