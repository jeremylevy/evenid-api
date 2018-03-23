var request = require('supertest');
var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getAppAccessTokenByOauthClient = require('../../../../testUtils/getAppAccessTokenByOauthClient');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var updateUser = require('../../../../testUtils/users/update');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;

var emailReg = '(?=[^}]*id)(?=[^}]*address)'
             + '(?=[^}]*is_verified)';

var phoneNumberReg = '(?=[^}]*id)(?=[^}]*number)'
                   + '(?=[^}]*type)';

var addressReg = '(?=[^}]*id":)'// `id":` -> Make sure we have id property not the `id` in residential
               + '(?=[^}]*full_name)(?=[^}]*address_line_1)'
               + '(?=[^}]*address_line_2)(?=[^}]*access_code)'
               + '(?=[^}]*city)(?=[^}]*state)'
               + '(?=[^}]*postal_code)(?=[^}]*country)'
               + '(?=[^}]*address_type)'
               + '(?=[^}]*for":\\[)';

var validUserReg = new RegExp('(?=.*id)(?=.*is_test_account)'
                            + '(?=.*emails":\\[{' + emailReg + ')'
                            + '(?=.*first_name)(?=.*last_name)'
                            + '(?=.*nickname)(?=.*profil_photo)'
                            + '(?=.*gender)(?=.*date_of_birth)'
                            + '(?=.*place_of_birth)(?=.*nationality)'
                            + '(?=.*timezone)'
                            + '(?=.*phone_numbers":\\[{' + phoneNumberReg + ')'
                            + '(?=.*addresses":\\[{' + addressReg + ')'
                            + '(?!.*password)'
                            + '(?!.*"_id")'
                            + '(?!.*"__v")');

describe('GET /users/:user_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, userID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/users/' + userID)
                        .set('Authorization', authHeader)
                        .expect('Content-Type', 'application/json; charset=utf-8')
                        .expect('Cache-Control', 'no-store')
                        .expect('Pragma', 'no-cache')
                        .expect(body)
                        .expect(statusCode, function (err, resp) {
                            if (err) {
                                return done(err);
                            }

                            assert.doesNotThrow(function () {
                                JSON.parse(resp.text);
                            });

                            done(null, resp);
                        });
                }.bind(this);

                if (this.userID) {
                    return cb(null, this.accessToken, this.userID);
                }

                getAppAccessToken(cb);
            };

            getAppAccessToken = getAppAccessToken(app);
            updateUser = updateUser(app);

            done();
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when wrong authorization header', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: user.id
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: user.id
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` '
       + 'error when expired access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 400, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when access token does not have authorization', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 400, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 200 and valid '
       + 'user when valid app access token', function (done) {

                            // Positive lookahead assertion
        var reg = new RegExp('(?=.*emails)(?=.*email)'
                           + '(?=.*first_name)(?=.*last_name)'
                           + '(?=.*nickname)(?=.*gender)'
                           + '(?=.*date_of_birth)'
                           + '(?=.*place_of_birth)(?=.*nationality)'
                           + '(?=.*timezone)'
                           + '(?=.*gravatar)(?=.*profil_photo)'
                           + '(?=.*phone_numbers)(?=.*addresses)'
                           + '(?=.*developer)(?=.*is_developer)'
                           + '(?=.*authorized_clients)'
                           + '(?=.*is_test_account)'
                           + '(?=.*user)'
                           + '(?=.*months)'
                           + '(?=.*territories)'
                           + '(?=.*nationalities)'
                           + '(?=.*timezones)'
                            // Negative lookahead assertion
                           + '(?!.*password)'
                           + '(?!.*"_id")'
                           + '(?!.*"__v")');

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            // Fill all user fields
            updateUser(accessToken, 
                       user.id,
                       {
                        first_name: 'John',
                        last_name: 'Rockerfeld',
                        nickname: mongoose.Types.ObjectId().toString(), 
                        gender: 'male', 
                        date_of_birth_month: '05',
                        date_of_birth_day: '18',
                        date_of_birth_year: '1992',
                        place_of_birth: 'FR',
                        nationality: 'FR',
                        timezone: 'Europe/Paris'
                       }, function (err, user) {
                
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 200, reg, done);
            });
        });
    });
    
    it('responds with HTTP code 200 and valid user when '
       + 'valid oauth client access token', function (done) {

        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }
            
            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.fakeUserID
            }, 200, validUserReg, done);
        });
    });
    
    // Check for bug when user is logged by user
    // and email is not set in 
    // oauth authorization scope entities
    it('responds with HTTP code 200 and valid user with email when '
       + 'user was logged by client', function (done) {

        getAppAccessTokenByOauthClient(function (err, resp) {
            if (err) {
                return done(err);
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: resp
            }, function (err, resp) {
                if (err) {
                    return done(err);
                }
                
                makeARequest.call({
                    accessToken: resp.accessToken,
                    userID: resp.fakeUserID
                }, 200, validUserReg, done);
            });
        }); 
    });
    
    it('responds with HTTP code 200 and prevents duplicates '
       + 'in phone number entities when user has registered '
       + 'on client and client add `mobile_phone_number` flag afterwards', function (done) {

        async.auto({
            // First, user register for the first time with client 
            // which ask for one phone number
            authorizePhoneNumbersScopeForUser: function (cb) {
                getOauthClientAccessToken.call({
                    redirectionURIScope: ['phone_numbers'],
                    redirectionURIScopeFlags: []
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, resp);
                });
            },

            // Then, client now wants mobile phone number 
            // and user must grant the authoriation once again
            authorizeMobilePhoneNumberScopeForUser: ['authorizePhoneNumbersScopeForUser',
                                                     function (cb, results) {
                
                var resp = results.authorizePhoneNumbersScopeForUser;
                var clientAccessToken = resp.accessToken;
                var user = resp.user;

                // Access token is set to oauth client access token
                // Reset it to app acess token to allow updating the redirection uri
                // and calling POST /oauth/authorize endpoint
                resp.accessToken = resp.appAccessToken;
                resp.validFormData = function () {
                    return {
                        mobile_phone_number: resp.user.phone_numbers[0].id
                    };
                };

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: resp,
                    redirectionURIScope: ['phone_numbers'],
                    redirectionURIScopeFlags: ['mobile_phone_number'],
                    // Change flow to login 
                    // in order to avoid `redirect_to_login_flow` step
                    registeredUser: true
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            // We need the last oauth client access token, with merged phone numbers
            var resp = results && results.authorizeMobilePhoneNumberScopeForUser;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.fakeUserID
            }, 200, /.+/, function (err, resp) {
                var user = resp.body;

                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.phone_numbers.length, 1);
                assert.strictEqual(user.phone_numbers[0].phone_type, 'mobile');

                done();
            });
        });
    });
    
    it('responds with HTTP code 200 and prevents duplicates '
       + 'in addresses entities when user has registered on '
       + 'client and client add `separate_shipping_billing_address` '
       + 'flag afterwards', function (done) {

        async.auto({
            // First, user register for the first time with client 
            // which ask for one address
            authorizeAddressesScopeForUser: function (cb) {
                getOauthClientAccessToken.call({
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: []
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, resp);
                });
            },

            // Then, client now wants shipping/billing address 
            // and user must grant the authoriation once again
            authorizeShippingBillingAddressScopeForUser: ['authorizeAddressesScopeForUser',
                                                          function (cb, results) {
                
                var resp = results.authorizeAddressesScopeForUser;
                var clientAccessToken = resp.accessToken;
                var user = resp.user;

                // Access token is set to oauth client access token
                // Reset it to app acess token to allow updating the redirection uri
                // and calling POST /oauth/authorize endpoint
                resp.accessToken = resp.appAccessToken;
                resp.validFormData = function () {
                    return {
                        shipping_address: resp.user.addresses[0].id,
                        use_as_billing_address: 'true'
                    };
                };

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: resp,
                    redirectionURIScope: ['addresses'],
                    redirectionURIScopeFlags: ['separate_shipping_billing_address'],
                    // Change flow to login 
                    // in order to avoid `redirect_to_login_flow` step
                    registeredUser: true
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }
                    
                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            // We need the last oauth client access token, with merged addresses
            var resp = results && results.authorizeShippingBillingAddressScopeForUser;

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.fakeUserID
            }, 200, /.+/, function (err, resp) {
                var user = resp.body;

                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.addresses.length, 1);
                assert.deepEqual(user.addresses[0].first_for, ['shipping', 'billing']);

                done();
            });
        });
    });
});