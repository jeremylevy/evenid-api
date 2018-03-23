var assert = require('assert');
var Type = require('type-of-is');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

module.exports = function (clientID, cb) {
    assert.ok(areValidObjectIDs([clientID]),
            'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(cb, Function),
            'argument `cb` must be a function');

    db.models.OauthClient.findById(clientID, 'statistics', function (err, oauthClient) {
        if (err) {
            return cb(err);
        }

        cb(null, oauthClient.statistics.test_accounts || 0);
    });
};