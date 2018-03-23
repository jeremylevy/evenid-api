var net = require('net');
var mongoose = require('mongoose');

var config = require('../config');

var Schema = mongoose.Schema;

var Event = Schema({
    ip_address: {
        type: String,
        index: true,
        validate: [{
            validator: function (IPAddress) {
                // Returns 0 for invalid strings, 
                // returns 4 for IP version 4 addresses, 
                // and returns 6 for IP version 6 addresses
                return net.isIP(IPAddress) !== 0;
            },
            msg: 'IP address is invalid.'
        }]
    },

    entities: {
        email: {
            type: String,
            index: true
        },

        user: {
            type: Schema.Types.ObjectId,
            index: true
        }
    },

    type: {
        type: String,
        required: true,
        enum: config.EVENID_EVENTS.TYPES
    },

    created_at: {
        type: Date,
        required: true,
        default: Date.now
    }
});

module.exports = Event;