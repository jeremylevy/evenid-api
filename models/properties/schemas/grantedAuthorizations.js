var assert = require('assert');

var mongoose = require('mongoose');

var config = require('../../../config');

var Schema = mongoose.Schema;

var validEntities = config.EVENID_OAUTH.ENTITIES_READY_FOR_UPDATE;

module.exports = function (entity) {
    assert.ok(validEntities.indexOf(entity) !== -1,
              'argument `entity` is invalid');

    var requiredValues = {
        // Granted authorizations were only used 
        // for convenience during validation
        _granted_authorizations: {
            type: Array,
            default: []
        }
    };

    if (entity !== 'users') {
        /* Used by convenience to 
           notify clients of the update */
        
        requiredValues.user = {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        };

        requiredValues._oauth_entities_id = {
            type: Array,
            default: []
        };
    }

    return requiredValues;
};