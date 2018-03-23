var mongoose = require('mongoose');

var config = require('../config');

var isEmpty = require('./validators/isEmpty');
var isValidUploadHash = require('./validators/isValidUploadHash');

var Schema = mongoose.Schema;

var Photo = Schema({
    sid: {
        // It's a hash
        type: String,
        unique: true,
        required: true,
        validate: [{
            validator: function (sid) {
                return isValidUploadHash(sid);
            },
            msg: 'Sid must be a valid upload hash.'
        }]
    }
});

module.exports = Photo;