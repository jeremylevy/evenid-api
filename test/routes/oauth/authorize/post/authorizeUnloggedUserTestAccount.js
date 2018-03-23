var testOauthAuthorizeTestAccountsErrors = require('../../../../../testUtils/tests/oauthAuthorizeTestAccountsErrors');
var testOauthAuthorizeTestAccountsSuccess = require('../../../../../testUtils/tests/oauthAuthorizeTestAccountsSuccess');

var isLoggedUser = false;

testOauthAuthorizeTestAccountsErrors(isLoggedUser);
testOauthAuthorizeTestAccountsSuccess(isLoggedUser);