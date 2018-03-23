var Type = require('type-of-is');

var insertOauthUserEvent = require('../../../../models/actions/insertOauthUserEvent');

module.exports = function (req, res, next) {
    var flow = req.query.flow;

    var client = res.locals.client;
    var user = res.locals.user;

    var useTestAccount = res.locals.useTestAccount;
    
    var testAccountUsedForTheFirstTime = res.locals.testAccountUsedForTheFirstTime;
    var registrationAfterTest = res.locals.registrationAfterTest;

    // Event types match flow (login, registration) 
    var eventTypes = [flow];

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `insertOauthUserEvent` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `insertOauthUserEvent` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `insertOauthUserEvent` '
                        + 'middleware');
    }

    if (!Type.is(testAccountUsedForTheFirstTime, Boolean)) {
        throw new Error('`testAccountUsedForTheFirstTime` must be set as response locals '
                        + 'property before calling `insertOauthUserEvent` '
                        + 'middleware');
    }

    if (!Type.is(registrationAfterTest, Boolean)) {
        throw new Error('`registrationAfterTest` must be set as response locals '
                        + 'property before calling `insertOauthUserEvent` '
                        + 'middleware');
    }

    if (useTestAccount) {
        if (!testAccountUsedForTheFirstTime) {
            return next();
        }

        eventTypes = ['test_account_registration'];
    }

    if (registrationAfterTest) {
        eventTypes.push('test_account_converted');
    }

    insertOauthUserEvent(user.id, client.id, eventTypes[0], function (err, oauthUserEvent) {
        if (err) {
            return next(err);
        }

        if (eventTypes.length > 1) {
            insertOauthUserEvent(user.id, client.id, eventTypes[1], function (err, oauthUserEvent) {
                if (err) {
                    return next(err);
                }

                next();
            });

            return;
        }

        next();
    });
};