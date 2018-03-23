var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');
var getUser = require('../middlewares/getUser');

module.exports = function (app, express) {
    // Used by app and clients
    var validScope = ['app'].concat(config.EVENID_OAUTH.VALID_USER_SCOPE);
    
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.get(uriReg, checkScope(validScope), getUser);
};