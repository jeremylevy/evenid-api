var Type = require('type-of-is');

var authorizeClientForUser = require('./authorizeClientForUser')
                                    ('useTestAccount');

module.exports = function (req, res, next) {
    var user = res.locals.user;
    var useTestAccount = res.locals.useTestAccount;
    var middlewareCount = 0;

    if (req.method !== 'POST') {
        throw new Error('`useTestAccount` middleware must be used '
                        + 'during `POST` requests');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `useTestAccount` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `useTestAccount` '
                        + 'middleware');
    }

    if (!useTestAccount) {
        return next();
    }

    // Hook next function in order to call `authorizeClientForUser` middlewares in order.
    // Indeed, if you don't hook the next function and pass 
    // the one given as parameter to this function it will call the next
    // registered middleware which is not the next `authorizeClientForUser`
    // middleware.
    authorizeClientForUser[0](req, res, function hookedNext (err) {
        middlewareCount++;

        if (err) {
            return next(err);
        }

        authorizeClientForUser[middlewareCount](req, res, hookedNext);
    });
};