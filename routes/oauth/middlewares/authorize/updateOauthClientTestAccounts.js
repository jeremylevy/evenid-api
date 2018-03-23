var Type = require('type-of-is');

var updateOauthClientTestAccounts = require('../../../../models/actions/updateOauthClientTestAccounts');

module.exports = function (req, res, next) {
    var flow = req.query.flow;

    var client = res.locals.client;
    var user = res.locals.user;

    var useTestAccount = res.locals.useTestAccount;

    var testAccountUsedForTheFirstTime = res.locals.testAccountUsedForTheFirstTime;
    var registrationAfterTest = res.locals.registrationAfterTest;

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `updateOauthClientTestAccounts` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `updateOauthClientTestAccounts` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `updateOauthClientTestAccounts` '
                        + 'middleware');
    }

    if (!Type.is(testAccountUsedForTheFirstTime, Boolean)) {
        throw new Error('`testAccountUsedForTheFirstTime` must be set as response locals '
                        + 'property before calling `updateOauthClientTestAccounts` '
                        + 'middleware');
    }

    if (!Type.is(registrationAfterTest, Boolean)) {
        throw new Error('`registrationAfterTest` must be set as response locals '
                        + 'property before calling `updateOauthClientTestAccounts` '
                        + 'middleware');
    }

    if (!registrationAfterTest 
        && !testAccountUsedForTheFirstTime) {
        
        return next();
    }

    updateOauthClientTestAccounts(user.id, client.id, 
                                  registrationAfterTest ? 'converted' : 'registered', 
                                  1, function (err) {
        if (err) {
            return next(err);
        }

        next();
    });
};