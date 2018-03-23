var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');

var updateUserPhoneNumber = require('../middlewares/updateUserPhoneNumber');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/phone-numbers/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.put(uriReg, checkScope('app'), updateUserPhoneNumber);
};