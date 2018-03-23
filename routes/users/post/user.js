var checkScope = require('../../oauth/middlewares/checkScope');

var createUser = require('../middlewares/createUser');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users$');

    app.post(uriReg,
             checkScope('unauthenticated_app'),
             createUser);
};