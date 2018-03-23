var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');

var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');
var findUser = require('../../../../../testUtils/users/find');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;
var app = null;

var oauthAuthorizeBeforeHookResp = null;

var formFieldsMatchingFullScope = null;
var addressFields = null;
var validFormData = null;

var fullScope = null;
var fullScopeFlags = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

describe('GET /users/:user_id (New addresses for)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            oauthAuthorizeBeforeHookResp = resp;

            formFieldsMatchingFullScope = resp.formFieldsMatchingFullScope;
            addressFields = resp.addressFields;

            fullScope = resp.fullScope;
            fullScopeFlags = resp.fullScopeFlags;
            
            validFormData = resp.validFormData;
            app = resp.app;
            
            accessToken = resp.accessToken;
            user = resp.user;
            
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            getUnauthenticatedAppAccessToken = getUnauthenticatedAppAccessToken(app);

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);
            findUser = findUser(app);

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

    it('works with shipping and billing addresses', function (done) {
        async.auto({
            updateRedirectionURI: function (cb) {
                var scope = fullScope.join(' ');
                var scopeFlags = fullScopeFlags.join(' ');

                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: scope,
                                            scope_flags: scopeFlags,
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            registerUser: ['updateRedirectionURI', function (cb) {
                var dataToSend = validFormData(formFieldsMatchingFullScope);

                makeARequest.call({
                    accessToken: accessToken
                }, 200, dataToSend, cb);
            }],

            getUser: ['registerUser', function (cb, results) {
                var registerUserResp = results.registerUser;
                
                var accessToken = registerUserResp.redirectTo
                                                  .match(/access_token=([0-9a-f]{40})/)[1];
                
                var userID = registerUserResp.redirectTo
                                             .match(/user_id=([0-9a-f]{24})/)[1];

                findUser(accessToken, userID, function (err, user) {
                    var firstFor = [];

                    if (err) {
                        return cb(err);
                    }

                    firstFor.push(user.addresses[0].first_for,
                                  user.addresses[1].first_for);
                    
                    assert.ok(compareArray(firstFor, [['shipping'], ['billing']]));

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('works with `use_as_billing_address` flag', function (done) {
        async.auto({
            updateRedirectionURI: function (cb) {
                var scope = fullScope.join(' ');
                var scopeFlags = fullScopeFlags.join(' ');

                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: scope,
                                            scope_flags: scopeFlags,
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            registerUser: ['updateRedirectionURI', function (cb) {
                var dataToSend = validFormData(formFieldsMatchingFullScope);

                dataToSend.use_as_billing_address = 'true';

                makeARequest.call({
                    accessToken: accessToken
                }, 200, dataToSend, cb);
            }],

            getUser: ['registerUser', function (cb, results) {
                var registerUserResp = results.registerUser;
                
                var accessToken = registerUserResp.redirectTo
                                                  .match(/access_token=([0-9a-f]{40})/)[1];
                
                var userID = registerUserResp.redirectTo
                                             .match(/user_id=([0-9a-f]{24})/)[1];

                findUser(accessToken, userID, function (err, user) {
                    var firstFor = [];

                    if (err) {
                        return cb(err);
                    }

                    // The two first addresses were added by first test
                    // The second by previous test
                    // The last now
                    firstFor.push(user.addresses[0].first_for,
                                  user.addresses[1].first_for,
                                  user.addresses[2].first_for);

                    assert.ok(compareArray(firstFor, [[], [], ['shipping', 'billing']]));

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('works with raw addresses', function (done) {
        async.auto({
            updateRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: 'addresses',
                                            scope_flags: '',
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            registerUser: ['updateRedirectionURI', function (cb) {
                var dataToSend = validFormData(addressFields);

                makeARequest.call({
                    accessToken: accessToken
                }, 200, dataToSend, cb);
            }],

            getUser: ['registerUser', function (cb, results) {
                var registerUserResp = results.registerUser;
                
                var accessToken = registerUserResp.redirectTo
                                                  .match(/access_token=([0-9a-f]{40})/)[1];
                
                var userID = registerUserResp.redirectTo
                                             .match(/user_id=([0-9a-f]{24})/)[1];

                findUser(accessToken, userID, function (err, user) {
                    var firstFor = [];

                    if (err) {
                        return cb(err);
                    }

                    // The two first addresses were added by previous test
                    firstFor.push(user.addresses[0].first_for,
                                  user.addresses[1].first_for,
                                  user.addresses[2].first_for,
                                  user.addresses[3].first_for);

                    assert.ok(compareArray(firstFor, [[], [], [], ['addresses']]));

                    cb();
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
});