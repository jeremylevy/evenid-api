var checkScope = require('../middlewares/checkScope');

module.exports = function (app, express) {
    app.get('/oauth/authorize/recover-password',
            checkScope('unauthenticated_app'),
            function (req, res, next) {
        
        res.send({
            // You can access `flow` directly 
            // from querystring
            // because it was validated by 
            // `checkQueryString` middleware
            flow: req.query.flow,
            client: res.locals.clientToSend
        });
    });
};