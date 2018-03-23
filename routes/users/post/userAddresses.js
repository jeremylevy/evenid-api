var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');

var addUserAddress = require('../middlewares/addUserAddress');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/addresses$');

    app.post(uriReg, checkScope('app'), addUserAddress);
};