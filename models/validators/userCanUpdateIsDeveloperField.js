var assert = require('assert');

var config = require('../../config');

var areValidObjectIDs = require('./areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

module.exports = function (isDeveloper) {
    assert.ok(areValidObjectIDs([this._id]),
            'context must be set as an `User` document');

    // Don't use assert for `isDeveloper` here 
    // it can contains
    // value passed through form by user

    var user = this;

    // Make sure user has removed all owned clients
    // before leaving the developer program
    return !!isDeveloper || user.developer.clients.length === 0;
};