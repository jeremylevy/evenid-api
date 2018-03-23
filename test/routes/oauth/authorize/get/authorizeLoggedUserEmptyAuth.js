var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');
var mongoose = require('mongoose');
var async = require('async');

var config = require('../../../../../config');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var createUserPhoneNumber = require('../../../../../testUtils/users/createPhoneNumber');
var createUserAddress = require('../../../../../testUtils/users/createAddress');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var updateUser = require('../../../../../testUtils/users/update');
var updateUserPhoneNumber = require('../../../../../testUtils/users/updatePhoneNumber');

var isValidClientToSend = require('../../../../../testUtils/validators/isValidOauthAuthorizeClientToSend');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

var profilPhotoURL = config.EVENID_AWS
                           .CLOUDFRONT
                           .URLS
                           .UPLOADS 
                   + '/'
                   + 'users/profil-photos/7d82704283791d8239f7295de51dee2c2ff203a0';

describe('GET /oauth/authorize (Logged user) (Empty authorizations)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            var getAppAccessToken = null;

            if (err) {
                return done(err);
            }

            app = resp.app;
            accessToken = resp.accessToken;
            user = resp.user;
            client = resp.client;
            redirectionURI = resp.redirectionURI;

            getAppAccessToken = function (cb) {
                cb(null, accessToken, user);
            };

            createUserAddress = createUserAddress(app, getAppAccessToken);
            createUserPhoneNumber = createUserPhoneNumber(app, getAppAccessToken);

            updateUser = updateUser(app);
            updateUserPhoneNumber = updateUserPhoneNumber(app);

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);

            makeARequest = function (userFields, 
                                     fieldsToShow, fieldsToAuthorize,
                                     hasUserFieldsToShow, cb) {

                var context = this;
                var flow = (context.flow || 'registration');
                var query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };
                var expectedStatusCode = (context.statusCode || 200);

                request(app)
                    .get('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .expect(expectedStatusCode, function (err, res) {
                        var resp = null;

                        if (err) {
                            return cb(err);
                        }

                        resp = res.body;

                        if (!context.dontAssertAuthResp) {
                            assert.strictEqual(resp.step, 'authorizations');
                            assert.strictEqual(resp.flow, flow);

                            isValidClientToSend(resp.client, client);

                            // Inputs displayed during oauth authorization
                            // are shared with app and use an `user` var
                            // to prefill the fields
                            assert.ok(compareArray(Object.keys(resp.user).sort(), userFields.sort()));

                            assert.strictEqual(resp.months.length, 12);
                            assert.ok(Object.keys(resp.territories).length > 0);
                            
                            assert.ok(Object.keys(resp.nationalities).length > 0);
                            assert.ok(Object.keys(resp.timezones).length > 0);
                            
                            assert.ok(compareArray(resp.fieldsToShow.sort(), fieldsToShow.sort()));
                            assert.ok(compareArray(Object.keys(resp.fieldsToAuthorize).sort(), fieldsToAuthorize.sort()));
                            
                            assert.strictEqual(resp.hasUserFieldsToShow, hasUserFieldsToShow);

                            assert.strictEqual(resp.installedApp, false);
                        }

                        cb(null, resp);
                    });
                };
            
            done();
        });
    });

    it('responds with HTTP code 200 and `redirect_to_registration_flow` '
       + 'step reply when unregistered user try to login', function (done) {
        
        makeARequest.call({
            flow: 'login',
            dontAssertAuthResp: true
        }, null, null, null, null, function (err, resp) {
            
            if (err) {
                return done(err);
            }

            assert.strictEqual(resp.step, 'redirect_to_registration_flow');
            
            assert.strictEqual(resp.clientName, client.name);

            done();
        });
    });

    it('responds with HTTP code 200 and `authorizations` '
       + 'step reply when full scope and empty user', function (done) {
        
        var newScope = config.EVENID_OAUTH.VALID_USER_SCOPE;
        var newScopeFlags = config.EVENID_OAUTH.VALID_USER_SCOPE_FLAGS;

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: newScope.join(' '), 
                                    scope_flags: newScopeFlags.join(' ')
                                  }, function (err) {

            // Always set (gravatar)
            var userFields = ['id', 'profil_photo'];
            var fieldsToShow = null;
            var fieldsToAuthorize = ['email'];
            var fieldsToRemove = config.EVENID_OAUTH.PLURAL_SCOPE.concat(fieldsToAuthorize);

            if (err) {
                return done(err);
            }

            // Email is always set 
            // so remove it of `fieldsToShow`
            fieldsToShow = newScope.filter(function (scopeValue) {
                return fieldsToRemove.indexOf(scopeValue) === -1;
            });

            fieldsToShow = fieldsToShow.concat(['mobile_phone_number', 
                                                'landline_phone_number', 
                                                'shipping_address', 
                                                'billing_address']);

            makeARequest(userFields, fieldsToShow, fieldsToAuthorize, true, done);
        });
    });
    
    it('responds with HTTP code 200 and `authorizations` step reply '
       + 'when specific scope and semi-empty user', function (done) {
        
        var newScope = [
            'first_name', 'last_name',
            'date_of_birth', 'addresses',
            'phone_numbers'
        ];

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {scope: newScope.join(' '), scope_flags: ''},
                                  function (err) {

            updateUser(accessToken, 
                       user.id,
                       {first_name: 'John', last_name: 'Rockerfeld'},
                       function (err) {

                var userFields = ['id', 'profil_photo', 'first_name', 'last_name'];
                var fieldsToShow = ['date_of_birth', 'address', 'phone_number'];
                var fieldsToAuthorize = ['first_name', 'last_name'];

                if (err) {
                    return done(err);
                }

                makeARequest(userFields, fieldsToShow, fieldsToAuthorize, true, done);
            });
        });
    });

    it('responds with HTTP code 200 and `authorizations` '
       + 'step reply and `hasUserFieldsToShow` set to `true` '
       + 'when only phone numbers need to be shown', function (done) {

        var newScopeFlags = ['mobile_phone_number', 'landline_phone_number'];

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id, 
                                  {
                                    scope: 'phone_numbers',
                                    scope_flags: newScopeFlags.join(' ')
                                  }, function (err) {

            // Previous test sets first and last name
            var userFields = ['id', 'profil_photo', 'first_name', 'last_name'];
            var fieldsToShow = ['mobile_phone_number', 'landline_phone_number'];
            var fieldsToAuthorize = [];

            if (err) {
                return done(err);
            }

            makeARequest(userFields, fieldsToShow, fieldsToAuthorize, true, done);
        });
    });

    it('responds with HTTP code 200 and `authorizations` '
       + 'step reply and `hasUserFieldsToShow` set to `false` '
       + 'when only address needs to be shown', function (done) {

        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: 'addresses', 
                                    scope_flags: 'separate_shipping_billing_address'
                                  }, function (err) {

            // Previous test sets first and last name
            var userFields = ['id', 'profil_photo', 'first_name', 'last_name'];
            var fieldsToShow = ['shipping_address', 'billing_address'];
            var fieldsToAuthorize = [];

            if (err) {
                return done(err);
            }

            makeARequest(userFields, fieldsToShow, fieldsToAuthorize, false, done);
        });
    });

    it('responds with HTTP code 200, `authorizations` step reply '
       + 'and empty `fieldsToShow` when full scope and full user', function (done) {
        
        var newScope = config.EVENID_OAUTH.VALID_USER_SCOPE;
        var newScopeFlags = config.EVENID_OAUTH.VALID_USER_SCOPE_FLAGS;

        async.auto({
            // Set full scope
            updateOauthRedirectionURI: function (cb) {
                updateOauthRedirectionURI(accessToken, 
                                          client.id,
                                          redirectionURI.id,
                                          {
                                            scope: newScope.join(' '), 
                                            scope_flags: newScopeFlags.join(' ')
                                          }, function (err) {

                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            /* Fill user entry in order to 
               have all fields in `fieldsToAuthorize` property */

            updateUser: function (cb) {
                updateUser(accessToken, 
                           user.id,
                           {
                            nickname: mongoose.Types.ObjectId().toString(),
                            profil_photo: profilPhotoURL,
                            gender: 'male', 
                            date_of_birth_month: '05',
                            date_of_birth_day: '18',
                            date_of_birth_year: '1992',
                            place_of_birth: 'FR',
                            nationality: 'FR',
                            timezone: 'Europe/Paris'
                           }, function (err, user) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            },

            /* Attach landline number to user */

            createUserPhoneNumber: function (cb) {
                createUserPhoneNumber(function (err, accessToken, userID, ID, number) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        userID: userID,
                        ID: ID
                    });
                });
            },

            updateUserPhoneNumber: ['createUserPhoneNumber', function (cb, results) {
                var phoneNumber = results.createUserPhoneNumber;

                updateUserPhoneNumber(accessToken, 
                                      phoneNumber.userID, 
                                      phoneNumber.ID,
                                      {phone_type: 'landline', number: '+33491387483'},
                                      function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            /* Attach mobile number to user */

            createUserPhoneNumber2: function (cb) {
                createUserPhoneNumber(function (err, accessToken, userID, ID, number) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        userID: userID,
                        ID: ID
                    });
                });
            },

            updateUserPhoneNumber2: ['createUserPhoneNumber2', function (cb, results) {
                var phoneNumber = results.createUserPhoneNumber2;

                updateUserPhoneNumber(accessToken, 
                                      phoneNumber.userID, 
                                      phoneNumber.ID, 
                                      {phone_type: 'mobile', number: '+33691387483'},
                                      function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }],

            /* Attach address to user */

            createUserAddress: function (cb) {
                createUserAddress(function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null);
                });
            }
        }, function (err, results) {
            var userFields = ['id', 'profil_photo', 
                              'first_name', 'last_name', 
                              'nickname', 'gender', 
                              'date_of_birth', 
                              'place_of_birth', 
                              'nationality', 'timezone'];
                
            var fieldsToAuthorize = newScope.concat(['mobile_phone_number', 
                                                     'landline_phone_number', 
                                                     'shipping_address', 
                                                     'billing_address',
                                                     'email']);

            if (err) {
                return done(err);
            }

            fieldsToAuthorize = fieldsToAuthorize.filter(function (scopeValue) {
                return config.EVENID_OAUTH.PLURAL_SCOPE.indexOf(scopeValue) === -1;
            });

            makeARequest(userFields, [], fieldsToAuthorize, false, done);
        });
    });
});