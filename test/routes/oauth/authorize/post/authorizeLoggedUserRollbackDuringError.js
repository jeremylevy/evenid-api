var assert = require('assert');
var request = require('supertest');

var querystring = require('querystring');

var config = require('../../../../../config');

var findUsers = require('../../../../../testUtils/db/findUsers');

var updateOauthRedirectionURI = require('../../../../../testUtils/clients/updateRedirectionURI');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');

var makeARequest = null;
var app = null;

var client = null;
var redirectionURI = null;

var accessToken = null;
var user = null;

var fullScope = null;
var fullScopeFlags = null;

var formFieldsMatchingFullScope = null;
var singularFields = null;

var validFormData = null;

var assertUserIsReverted = function (user, cb) {
    findUsers([user.id], function (err, users) {
        var user = users && users[0];

        if (err) {
            return cb(err);
        }

        assert.strictEqual(users.length, 1);

        singularFields.forEach(function (singularField) {
            assert.strictEqual(user[singularField], undefined);
        });

        assert.strictEqual(user.emails.length, 1);
        assert.strictEqual(user.phone_numbers.length, 0);
        assert.strictEqual(user.addresses.length, 0);

        cb(null);
    });
};

describe('POST /oauth/authorize (Logged user) (Rollback during error)', function () {
    before(function (done) {
        oauthAuthorizeBeforeHook(function (err, resp) {
            if (err) {
                return done(err);
            }

            app = resp.app;
            accessToken = resp.accessToken;
            
            user = resp.user;
            client = resp.client;
            
            redirectionURI = resp.redirectionURI;
            formFieldsMatchingFullScope = resp.formFieldsMatchingFullScope;
            
            singularFields = resp.singularFields;
            validFormData = resp.validFormData;
            
            fullScope = resp.fullScope;
            fullScopeFlags = resp.fullScopeFlags;

            updateOauthRedirectionURI = updateOauthRedirectionURI(app);

            makeARequest = function (statusCode, data, cb) {
                var context = this;
                var flow = (context.flow || 'registration');
                var query = null;

                query = {
                    client_id: client.client_id.toString(),
                    redirect_uri: redirectionURI.uri,
                    state: 'foo',
                    flow: flow
                };

                request(app)
                    .post('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
                    .set('Content-Type', 'application/x-www-form-urlencoded')
                    .send(data)
                    .expect(statusCode, function (err, res) {
                        var resp = null;

                        if (err) {
                            return cb(err);
                        }

                        resp = res.body;

                        cb(null, resp);
                    });
            };
            
            done();
        });
    });
    
    // Tests need redirection uri
    // to contain full scope
    before(function (done) {
        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: fullScope,
                                    scope_flags: fullScopeFlags
                                  }, function (err) {

            if (err) {
                return done(err);
            }

            done(null);
        });
    });

    it('responds with HTTP code 400 and rollback '
       + 'for invalid user field', function (done) {

        var formData = validFormData(formFieldsMatchingFullScope);

        formData.gender = 'bar';

        makeARequest(400, formData, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertUserIsReverted(user, done);
        });
    });

    it('responds with HTTP code 400 and rollback '
       + 'for invalid email', function (done) {

        var formData = validFormData(formFieldsMatchingFullScope);

        formData.email = 'bar';

        makeARequest(400, formData, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertUserIsReverted(user, done);
        });
    });

    it('responds with HTTP code 400 and rollback '
       + 'for invalid phone number', function (done) {

        var formData = validFormData(formFieldsMatchingFullScope);

        formData.mobile_phone_number_number = 'bar';

        makeARequest(400, formData, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertUserIsReverted(user, done);
        });
    });

    it('responds with HTTP code 400 and rollback '
       + 'for invalid address', function (done) {

        var formData = validFormData(formFieldsMatchingFullScope);

        formData.shipping_address_country = 'bar';

        makeARequest(400, formData, function (err, resp) {
            if (err) {
                return done(err);
            }

            assertUserIsReverted(user, done);
        });
    });
});