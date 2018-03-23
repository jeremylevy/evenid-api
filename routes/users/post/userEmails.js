var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');

var addUserEmail = require('../middlewares/addUserEmail');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/emails$');

    app.post(uriReg, checkScope('app'), addUserEmail);
};