var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');
var updateOauthClient = require('../../../../../testUtils/clients/update');

var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var findOauthEntitiesID = require('../../../../../testUtils/db/findOauthEntitiesID');
var findOauthUserStatus = require('../../../../../testUtils/db/findOauthUserStatus');

var findOauthAuthorizations = require('../../../../../testUtils/db/findOauthAuthorizations');

var makeARequest = null;
var app = null;

var oauthAuthorizeBeforeHookResp = null;

var formFieldsMatchingFullScope = null;
var validFormData = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

describe('ALL /oauth/authorize (Bound test account to user)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            oauthAuthorizeBeforeHookResp = resp;
            formFieldsMatchingFullScope = resp.formFieldsMatchingFullScope;
            
            validFormData = resp.validFormData;
            app = resp.app;
            
            accessToken = resp.accessToken;
            user = resp.user;
            
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);
            updateOauthClient = updateOauthClient(app);

            deleteAuthorizedClientForUser = deleteAuthorizedClientForUser(app);

            makeARequest = function (statusCode, data, done) {
                var cb = function (err, accessToken) {
                    var context = this;

                    var req = null;
                    var query = null;

                    if (err) {
                        return done(err);
                    }

                    query = {
                        client_id: client.client_id.toString(),
                        redirect_uri: redirectionURI.uri,
                        state: 'foo',
                        flow: 'registration'
                    };

                    req = request(app)
                            .post('/oauth/authorize?' + querystring.stringify(query))
                            .set('X-Originating-Ip', '127.0.0.1')
                            .set('Authorization', 'Bearer ' + accessToken)
                            .set('Content-Type', 'application/x-www-form-urlencoded');

                    req.send(data)
                       .expect(statusCode, function (err, res) {
                            var resp = null;

                            if (err) {
                                return done(err);
                            }

                            resp = res.body;

                            done(null, resp);
                        });
                }.bind(this);

                if (this.accessToken) {
                    return cb(null, this.accessToken);
                }

                getUnauthenticatedAppAccessToken(cb);
            };
            
            done();
        });
    });

    afterEach(function (done) {
        deleteAuthorizedClientForUser(accessToken, user.id, client.id, done);
    });
    
    it('works when user use test account '
       + 'being unlogged then login', function (done) {

        async.auto({
            updateOauthClient: function (cb) {
                updateOauthClient(accessToken, 
                                  client.id, 
                                  {authorize_test_accounts: 'true'}, 
                                  cb);
            },

            testAsUnlogged: ['updateOauthClient', function (cb, results) {
                makeARequest(200, {
                    use_test_account: 'true'
                }, function (err, resp) {
                    var testAccountID = resp && resp.userID;

                    if (err) {
                        return cb(err);
                    }

                    cb(null, testAccountID);
                });
            }],

            registerUserWithTestAccountAsLogged: ['testAsUnlogged', function (cb, results) {
                var testAccountID = results.testAsUnlogged;
                var dataToSend = validFormData(formFieldsMatchingFullScope);

                dataToSend.test_account = testAccountID;

                makeARequest.call({
                    accessToken: accessToken
                }, 200, dataToSend, cb);
            }],

            assertOauthEntitiesIDWereUpdated: ['registerUserWithTestAccountAsLogged', function (cb, results) {
                var testAccountID = results.testAsUnlogged;

                findOauthEntitiesID({
                    user: testAccountID
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesID.length, 0);

                    cb(null);
                });
            }],

            assertOauthUserStatusWasUpdated: ['registerUserWithTestAccountAsLogged', function (cb, results) {
                var testAccountID = results.testAsUnlogged;

                findOauthUserStatus([client.id], [testAccountID], function (err, oauthUserStatus) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserStatus.length, 0);

                    cb(null);
                });
            }],

            assertOauthAuthorizationsWereUpdated: ['registerUserWithTestAccountAsLogged', function (cb, results) {
                var testAccountID = results.testAsUnlogged;

                findOauthAuthorizations.call({
                    findConditions: {
                        issued_for: testAccountID
                    }
                }, null, function (err, oauthAuthorizations) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthAuthorizations.length, 0);

                    cb(null);
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    // Added after a bug which triggered an unique index error
    // on OauthUserStatus `user_1_client: 'This user 1 client is already used.'`
    // given that we wanted to update test account user status user property
    // to match real user which already have an user status.
    it('works when user use test account being unlogged '
       + 'then use test account being logged then register', function (done) {

        async.auto({
            updateOauthClient: function (cb) {
                updateOauthClient(accessToken, 
                                  client.id, 
                                  {authorize_test_accounts: 'true'}, 
                                  cb);
            },

            testAsUnlogged: ['updateOauthClient', function (cb, results) {
                makeARequest(200, {
                    use_test_account: 'true'
                }, function (err, resp) {
                    var testAccountID = resp && resp.userID;

                    if (err) {
                        return cb(err);
                    }

                    cb(null, testAccountID);
                });
            }],

            testAsLogged: ['testAsUnlogged', function (cb, results) {
                makeARequest.call({
                    accessToken: accessToken
                }, 200, {
                    use_test_account: 'true'
                }, cb);
            }],

            registerUserWithTestAccountAsLogged: ['testAsLogged', function (cb, results) {
                var testAccountID = results.testAsUnlogged;
                var dataToSend = validFormData(formFieldsMatchingFullScope);

                dataToSend.test_account = testAccountID;

                makeARequest.call({
                    accessToken: accessToken
                }, 200, dataToSend, cb);
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});