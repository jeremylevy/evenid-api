var checkQueryString = require('./checkQueryString');
var checkClientAndRedirectURI = require('./checkClientAndRedirectURI');

var findFieldsToAuthorize = require('./findFieldsToAuthorize');

var prepareOauthAuthorization = require('./prepareOauthAuthorization');
var fillOauthAuthorizationWithReqBody = require('./fillOauthAuthorizationWithReqBody');

var genAuthorizationCode = require('./genAuthorizationCode');
var insertOauthAuthorization = require('./insertOauthAuthorization');

var insertOauthAccessToken = require('./insertOauthAccessToken');
var boundTestAccountToUser = require('./boundTestAccountToUser');

var insertOauthEntitiesID = require('./insertOauthEntitiesID');
var insertOauthUserEvent = require('./insertOauthUserEvent');

var genURLToRedirectUserTo = require('./genURLToRedirectUserTo');
var updateOauthUserStatusIfNeeded = require('./updateOauthUserStatusIfNeeded');

var setOauthUserEntityID = require('./setOauthUserEntityID');
var setOauthUserStatus = require('./setOauthUserStatus');

var checkUserTestAccountStatus = require('./checkUserTestAccountStatus');

var updateOauthClientTestAccounts = require('./updateOauthClientTestAccounts');
var updateOauthClientRegisteredUsers = require('./updateOauthClientRegisteredUsers');

// Closure
var SendResponse = require('./sendResponse');

// `usedFor`: `authorizeLoggeduser`, 
// `authorizeUnloggedUser` or `useTestAccount`
module.exports = function (usedFor) {
    var sendResponse = SendResponse(usedFor);

    return [
        function (req, res, next) {
            if (req.method !== 'POST') {
                throw new Error('`authorizeClientForUser` middleware must be used '
                                + 'during `POST` requests');
            }

            next();
        },
        checkQueryString,
        function (req, res, next) {
            if (res.locals.client) {
                return next();
            }

            checkClientAndRedirectURI(req, res, next);
        },
        function (req, res, next) {
            if ((res.locals.fieldsToShow
                 && res.locals.fieldsToAuthorize)
                // Given by `checkClientAuthorizeTestAccounts` middleware
                // set on index.
                // We set the check here, not in `findFieldsToAuthorize` middleware
                // because `findFieldsToAuthorize` middleware is also used 
                // in authorize logged user GET method
                // which doesn't have test account managing and
                // `findFieldsToAuthorize` is also set AFTER `useTestAccount`
                // middleware in POST requests, 
                // so never called if test account was used
                || res.locals.useTestAccount) {

                return next();
            }

            findFieldsToAuthorize(req, res, next);
        },
        prepareOauthAuthorization, 
        fillOauthAuthorizationWithReqBody,
        checkUserTestAccountStatus,
        boundTestAccountToUser,
        updateOauthUserStatusIfNeeded,
        genAuthorizationCode,
        insertOauthAuthorization,
        //insertOauthEntitiesID, 
        insertOauthAccessToken,
        setOauthUserEntityID,
        setOauthUserStatus,
        genURLToRedirectUserTo, 
        insertOauthUserEvent,
        updateOauthClientTestAccounts,
        updateOauthClientRegisteredUsers,
        sendResponse
    ];
};