var validator = require('validator');

var config = require('../../../../config');

var db = require('../../../../models');

var InvalidRequestError = require('../../../../errors/types/InvalidRequestError');
var AccessDeniedError = require('../../../../errors/types/AccessDeniedError');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                               (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

// Used on index before all POST routes
module.exports = function (req, res, next) {
    // Test account can be set without `use_test_account`
    // if user register after testing for example
    var testAccount = req.body.test_account;

    if (req.method !== 'POST') {
        throw new Error('`lookupTestAccount` middleware must be used '
                        + 'during `POST` requests');
    }

    // Make sure passed test account was an Object ID
    if (testAccount 
        && !areValidObjectIDs([testAccount])) {

        return next(new InvalidRequestError({
            test_account: 'Passed test account is invalid.'
        }));
    }

    // Test account can be set without `use_test_account`
    // if user register after testing for example
    if (testAccount) {
        db.models.User.findOne({
            _id: testAccount,
            is_test_account: true
        }, function (err, user) {
            if (err) {
                return next(err);
            }
            
            // Invalid user ID or not a test account?
            if (!user) {
                return next(new AccessDeniedError());
            }

            res.locals.testAccount = user;

            next();
        });

        return;
    }

    next();
};