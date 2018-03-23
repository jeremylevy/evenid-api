var testOauthAuthorizeTestAccountsErrors = require('../../../../../testUtils/tests/oauthAuthorizeTestAccountsErrors');
var testOauthAuthorizeTestAccountsSuccess = require('../../../../../testUtils/tests/oauthAuthorizeTestAccountsSuccess');

var isLoggedUser = true;

testOauthAuthorizeTestAccountsErrors(isLoggedUser);
testOauthAuthorizeTestAccountsSuccess(isLoggedUser);