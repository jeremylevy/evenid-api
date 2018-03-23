var assert = require('assert');
var Type = require('type-of-is');

var mongoose = require('mongoose');

var config = require('../../../config');

var isValidAddressFor = require('../../validators/isValidAddressFor');

var Schema = mongoose.Schema;

var validEntities = ['userAuthorization', 'oauthAuthorization'];

module.exports = function (entity) {
    assert.ok(validEntities.indexOf(entity) !== -1,
              'argument `entity` is invalid');

    var requiredValues = {};

    if (entity === 'oauthAuthorization') {
        requiredValues.addresses = [{
            address: {
                type: Schema.Types.ObjectId,
                ref: 'Address'
            },

            'for': {
                type: Array,
                validate: [{
                    validator: isValidAddressFor,
                    msg: 'Address for is not an allowed value.'
                }]
            }
        }];
    }

    if (entity === 'userAuthorization') {
        // User may have many email addresses
        // keep ref to the one authorized
        requiredValues.emails = [{
            type: Schema.Types.ObjectId,
            ref: 'Email'
        }];

        // User may have many phone numbers
        // keep ref to the one authorized
        requiredValues.phone_numbers = [{
            type: Schema.Types.ObjectId,
            ref: 'PhoneNumber'
        }];

        requiredValues.addresses = [{
            type: Schema.Types.ObjectId,
            ref: 'Address'
        }];
    }

    return requiredValues;
};