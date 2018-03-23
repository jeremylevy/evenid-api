var mongoose = require('mongoose');

var config = require('../config');

var createHash = require('./createHash');

module.exports = function () {
    // Guaranteed to be unique
    return createHash(
        config.EVENID_UPLOADS.HASH.ALGORITHM,
        mongoose.Types.ObjectId().toString()
    );
};