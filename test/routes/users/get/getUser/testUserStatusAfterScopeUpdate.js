var request = require('supertest');
var assert = require('assert');

var async = require('async');

var config = require('../../../../../config');

var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var compareArray = require('../../../../../testUtils/lib/compareArray');

var makeARequest = null;

var testFromScopeToScope = function (fromScope, fromScopeFlags, 
                                     toScope, toScopeFlags, done) {

    var context = this;

    async.auto({
        // First, client wants from scope
        authorizeClientForUser: function (cb) {
            getOauthClientAccessToken.call({
                redirectionURIScope: fromScope,
                redirectionURIScopeFlags: fromScopeFlags,
                useTestAccount: true
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        },

        // We get the user to pass from `new_user` to `existing_user`
        getUser: ['authorizeClientForUser', function (cb, results) {
            var authorizeClientForUserResp = results.authorizeClientForUser;
            
            var app = authorizeClientForUserResp.app;
            var accessToken = authorizeClientForUserResp.accessToken;
            var userID = authorizeClientForUserResp.fakeUserID;
            
            makeARequest(app, accessToken, userID, 200, function (err, user) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(user.status, 'new_user');

                cb(null, user);
            });
        }],

        // Now client wants to scope
        updateScope: ['getUser', function (cb, results) {
            var oauthAuthBeforeHookResp = results.authorizeClientForUser
                                                 .oauthAuthBeforeHookResp;
            var oldValidFormDataFn = oauthAuthBeforeHookResp.validFormData;

            if (context.toScopeData) {
                oauthAuthBeforeHookResp.validFormData = context.toScopeData(results.authorizeClientForUser);
            }

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: oauthAuthBeforeHookResp,
                redirectionURIScope: toScope,
                redirectionURIScopeFlags: toScopeFlags,
                // We need to change flow to avoid redirect to login
                registeredUser: true,
                useTestAccount: true
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                // Reset value
                oauthAuthBeforeHookResp.validFormData = oldValidFormDataFn;

                cb(null, resp)
            });
        }]
    }, function (err, results) {
        var updateScopeResp = results && results.updateScope;
        var app = updateScopeResp.app;
        var accessToken = updateScopeResp.accessToken;
        var userID = updateScopeResp.fakeUserID;

        if (err) {
            return done(err);
        }

        makeARequest(app, accessToken, userID, 200, function (err, user) {
            if (err) {
                return done(err);
            }

            // Same address is used no matter what 
            // when test account is used so if `toScope`
            // only contains address we are sure that it will send 
            // `existing_user`
            if ((toScope.length > 1 || toScope[0] !== 'addresses')
                && !context.expectedUserStatus) {
                
                assert.strictEqual(user.status, 'existing_user_after_update');
            } else {
                assert.strictEqual(user.status, context.expectedUserStatus || 'existing_user');
            }

            done(null, user);
        });
    });
};

describe('GET /users/:user_id (User status) (After scope update) (Test users)', function () {
    before(function (done) {
        makeARequest = function (app, accessToken, userID, statusCode, done) {
            var cb = function (err, accessToken, userID) {
                if (err) {
                    return done(err);
                }

                request(app)
                    .get('/users/' + userID)
                    .set('Authorization', 'Bearer ' + accessToken)
                    .expect('Content-Type', 'application/json; charset=utf-8')
                    .expect('Cache-Control', 'no-store')
                    .expect('Pragma', 'no-cache')
                    .expect(statusCode, function (err, resp) {
                        if (err) {
                            return done(err);
                        }

                        assert.doesNotThrow(function () {
                            JSON.parse(resp.text);
                        });

                        done(null, resp.body);
                    });
            };

            cb(null, accessToken, userID);
        };

        done();
    });
    
    it('responds with `existing_user_after_update` '
       + 'from `first_name` to full scope', function (done) {

        testFromScopeToScope(['first_name'], [], 
                             config.EVENID_OAUTH.VALID_USER_SCOPE,
                             config.EVENID_OAUTH.VALID_USER_SCOPE_FLAGS,
                             function (err, user) {

            // Remove first name authorized first
            var updatedFields = config.EVENID_OAUTH.VALID_USER_SCOPE.filter(function (v) {
                return v !== 'first_name';
            });

            if (err) {
                return done(err);
            }

            assert.ok(compareArray(user.updated_fields, updatedFields));

            Object.keys(config.EVENID_OAUTH.VALID_ENTITY_FIELDS).forEach(function (entityName) {
                var entityNB = 1;

                if (entityName === 'USERS') {
                    return;
                }

                if (entityName === 'PHONE_NUMBERS') {
                    entityNB = 2;
                }

                assert.strictEqual(user[entityName.toLowerCase()].length, entityNB);

                user[entityName.toLowerCase()].forEach(function (entity) {
                    assert.strictEqual(entity.status, 'new');

                    assert.ok(compareArray(entity.updated_fields, []));
                });
            });

            done();
        });
    });
    
    // Test accounts use same number 
    // for unknown and mobile phone type
    it('responds with `existing_user` from unknown '
       + 'phone number to mobile phone number', function (done) {

        testFromScopeToScope.call({
            expectedUserStatus: 'existing_user'
        }, ['phone_numbers'], [], ['phone_numbers'], ['mobile_phone_number'],
        function (err, user) {

            var newPhoneNumber = null;

            if (err) {
                return done(err);
            }

            assert.ok(compareArray(user.updated_fields, []));

            assert.strictEqual(user.phone_numbers.length, 1);

            newPhoneNumber = user.phone_numbers[0];

            assert.strictEqual(newPhoneNumber.status, 'old');
            assert.ok(compareArray(newPhoneNumber.updated_fields, []));
            assert.strictEqual(newPhoneNumber.phone_type, 'mobile');

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown phone number to landline phone number', function (done) {

        testFromScopeToScope(['phone_numbers'], [], 
                             ['phone_numbers'],
                             ['landline_phone_number'],
                             function (err, user) {

            var newPhoneNumber = null;

            if (err) {
                return done(err);
            }

            assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

            assert.strictEqual(user.phone_numbers.length, 1);

            newPhoneNumber = user.phone_numbers[0];

            assert.strictEqual(newPhoneNumber.status, 'new');
            assert.ok(compareArray(newPhoneNumber.updated_fields, []));
            assert.strictEqual(newPhoneNumber.phone_type, 'landline');

            done();
        });
    });

    it('responds with `existing_user_after_update` from '
       + 'unknown phone number to landline and mobile '
       + 'phone number', function (done) {

        testFromScopeToScope(['phone_numbers'], [], 
                             ['phone_numbers'],
                             ['landline_phone_number', 'mobile_phone_number'],
                             function (err, user) {

            var newPhoneNumber = null;
            var returnedPhoneTypes = [];

            if (err) {
                return done(err);
            }

            assert.ok(compareArray(user.updated_fields, ['phone_numbers']));

            assert.strictEqual(user.phone_numbers.length, 2);

            user.phone_numbers.forEach(function (newPhoneNumber) {
                // Test accounts use same number 
                // for unknown and mobile phone type
                assert.strictEqual(newPhoneNumber.status, 
                                   newPhoneNumber.phone_type === 'mobile' ? 'old' : 'new');
                
                assert.ok(compareArray(newPhoneNumber.updated_fields, []));
                
                returnedPhoneTypes.push(newPhoneNumber.phone_type);
            });

            assert.ok(compareArray(returnedPhoneTypes, ['landline', 'mobile']));

            done();
        });
    });

    it('responds with `existing_user_after_update` '
       + 'from unknown address to shipping billing address', function (done) {

        testFromScopeToScope(['addresses'], [], 
                             ['addresses'],
                             ['separate_shipping_billing_address'],
                             function (err, user) {

            var oldAddress = null;

            if (err) {
                return done(err);
            }

            assert.ok(compareArray(user.updated_fields, []));

            assert.strictEqual(user.addresses.length, 1);

            oldAddress = user.addresses[0];

            done();
        });
    });
});