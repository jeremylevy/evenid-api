var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var async = require('async');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getUnauthenticatedAppAccessToken = require('../../../../../testUtils/getUnauthenticatedAppAccessToken');

var deleteAuthorizedClientForUser = require('../../../../../testUtils/users/deleteAuthorizedClientForUser');
var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var findUser = require('../../../../../testUtils/users/find');
var createAddress = require('../../../../../testUtils/users/createAddress');

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

var addresses = [];

describe('GET /users/:user_id (Authorized addresses for)', function () {
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
            createAddress = createAddress(app, function (cb) {
                cb(null, accessToken, user);
            });

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

    before(function (done) {
        createAddress(function (err, accessToken, userID, addressID) {
            if (err) {
                return done(err);
            }

            addresses.push(addressID);

            done();
        });
    });

    before(function (done) {
        createAddress(function (err, accessToken, userID, addressID) {
            if (err) {
                return done(err);
            }

            addresses.push(addressID);

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
                                            scope: 'addresses',
                                            scope_flags: 'separate_shipping_billing_address',
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            registerUser: ['updateRedirectionURI', function (cb) {
                var dataToSend = {
                    shipping_address: addresses[0],
                    billing_address: addresses[1]
                };

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
                    if (err) {
                        return cb(err);
                    }

                    if (user.addresses[0].id === addresses[0]) {
                        assert.ok(compareArray(user.addresses[0].first_for, ['shipping']));
                    } else {
                        assert.ok(compareArray(user.addresses[1].first_for, ['billing']));
                    }

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
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: 'addresses',
                                            scope_flags: 'separate_shipping_billing_address',
                                            response_type: 'token'
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            registerUser: ['updateRedirectionURI', function (cb) {
                var dataToSend = {};

                dataToSend.shipping_address = addresses[0];
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
                    if (err) {
                        return cb(err);
                    }

                    if (user.addresses[0].id === addresses[0]) {
                        assert.ok(compareArray(user.addresses[0].first_for, ['shipping', 'billing']));
                    } else {
                        assert.ok(compareArray(user.addresses[1].first_for, []));
                    }

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

                dataToSend.address = addresses[0];

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
                    if (err) {
                        return cb(err);
                    }

                    if (user.addresses[0].id === addresses[0]) {
                        assert.ok(compareArray(user.addresses[0].first_for, ['addresses']));
                    } else {
                        assert.ok(compareArray(user.addresses[1].first_for, []));
                    }

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