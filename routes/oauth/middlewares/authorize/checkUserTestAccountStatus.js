var Type = require('type-of-is');

var findOauthUserStatus = require('../../../../models/actions/findOauthUserStatus');

module.exports = function (req, res, next) {
    var client = res.locals.client;
    var user = res.locals.user;
    var useTestAccount = res.locals.useTestAccount;

    if (req.method !== 'POST') {
        throw new Error('`checkUserTestAccountStatus` middleware must be used '
                        + 'during `POST` requests');
    }

    if (!client) {
        throw new Error('`client` must be set as response locals '
                        + 'property before calling `checkUserTestAccountStatus` '
                        + 'middleware');
    }

    if (!user) {
        throw new Error('`user` must be set as response locals '
                        + 'property before calling `checkUserTestAccountStatus` '
                        + 'middleware');
    }

    if (!Type.is(useTestAccount, Boolean)) {
        throw new Error('`useTestAccount` must be set as response locals '
                        + 'property before calling `checkUserTestAccountStatus` '
                        + 'middleware');
    }

    res.locals.testAccountUsedForTheFirstTime = false;
    res.locals.registrationAfterTest = false;

    // Used to count test account 
    // registrations and conversions
    findOauthUserStatus(client._id, user._id, function (err, oauthUserStatus) {
        if (err) {
            return next(err);
        }

        if (!oauthUserStatus) {
            res.locals.testAccountUsedForTheFirstTime = !!useTestAccount;

            return next();
        }

        if (!useTestAccount) {
            res.locals.registrationAfterTest = !!oauthUserStatus.use_test_account;
        }

        next();
    });
};