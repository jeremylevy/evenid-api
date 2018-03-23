var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');

var addUserPhoneNumber = require('../middlewares/addUserPhoneNumber');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/phone-numbers$');

    app.post(uriReg, checkScope('app'), addUserPhoneNumber);
};