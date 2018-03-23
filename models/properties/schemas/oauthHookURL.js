var assert = require('assert');
var util = require('util');

var config = require('../../../config');

var isEmpty = require('../../validators/isEmpty');
var isValidWebsiteURL = require('../../validators/isValidWebsiteURL');

var validEntities = ['oauthClient', 'oauthHook'];

module.exports = function (entity) {
    assert.ok(validEntities.indexOf(entity) !== -1,
              'argument `entity` is invalid');

    var required = true;

    if (entity === 'oauthClient') {
        required = false;
    }

    return {
        type: String,
        required: required,
        // One url can manage multiple events
        // So don't set an unique index here
        validate: [
            {
                validator: isValidWebsiteURL,
                msg: 'This URL is not valid.'
            },

            {
                validator: function (URL) {
                    return isEmpty(URL) 
                        || URL.length <= config.EVENID_OAUTH_HOOKS
                                               .MAX_LENGTHS
                                               .URL;
                },
                msg: util.format('This URL is too long. (Max %d characters.)',
                                 config.EVENID_OAUTH_HOOKS
                                       .MAX_LENGTHS
                                       .URL)
            }
        ]
    };
};