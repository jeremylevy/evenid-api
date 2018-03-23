var token = require('../../../../testUtils/tests/oauthToken/refreshTokenGrantType');

token('header', 'app');
token('request', 'app');

token('header', 'client');
token('request', 'client');