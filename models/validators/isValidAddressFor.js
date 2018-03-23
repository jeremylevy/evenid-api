var Type = require('type-of-is');

var config = require('../../config');

module.exports = function (addressFor) {
    if (!Type.is(addressFor, Array)
        || addressFor.length === 0) {
        
        return false;
    }

    for (var i = 0, j = addressFor.length; i < j; ++i) {
        if (config.EVENID_ADDRESSES.FOR
                  .indexOf(addressFor[i]) === -1) {
            
            return false;
        }
    }

    return true;
};