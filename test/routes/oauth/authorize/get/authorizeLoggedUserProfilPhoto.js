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

var singularScope = config.EVENID_OAUTH
                          .VALID_USER_SCOPE.filter(function (scope) {
    return config.EVENID_OAUTH
                 .PLURAL_SCOPE.indexOf(scope) === -1;
});

var formFieldsMatchingFullScope = null;
var validFormData = null;

var profilPhotoURL = config.EVENID_AWS
                           .CLOUDFRONT
                           .URLS
                           .UPLOADS 
                   + '/'
                   + 'users/profil-photos/7d82704283791d8239f7295de51dee2c2ff203a0';

describe('GET /oauth/authorize (Logged user) (Profil photo)', function () {
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

            validFormData = resp.validFormData;
            updateOauthRedirectionURI = updateOauthRedirectionURI(app);

            makeARequest = function (statusCode, cb) {
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
                    .get('/oauth/authorize?' + querystring.stringify(query))
                    .set('Authorization', 'Bearer ' + accessToken)
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
    
    // Ease tests by working only
    // on user field scope
    before(function (done) {
        updateOauthRedirectionURI(accessToken, 
                                  client.id,
                                  redirectionURI.id,
                                  {
                                    scope: singularScope,
                                    scope_flags: []
                                  }, function (err) {

            if (err) {
                return done(err);
            }

            done();
        });
    });

    // We need user to be a model instance
    // to have a save method
    before(function (done) {
        findUsers([user.id], function (err, users) {
            if (err) {
                return done(err);
            }

            assert.strictEqual(users.length, 1);

            user = users[0];

            done();
        });
    });

    it('sets profil photo to field to show '
       + 'when its the sole field to authorize', function (done) {

        user.profil_photo = profilPhotoURL;

        user.save(function (err, user) {
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, resp) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(Object.keys(resp.fieldsToAuthorize).length, 0);

                assert.ok(resp.fieldsToShow.indexOf('profil_photo') !== -1);

                assert.strictEqual(resp.hasUserFieldsToShow, true);

                done();
            });
        });
    });

    it('doesn\'t set profil photo to field to show '
       + 'when its not the sole field to authorize', function (done) {

        var userGender = 'male';

        user.gender = userGender;
        user.profil_photo = profilPhotoURL;

        user.save(function (err, user) {
            if (err) {
                return done(err);
            }

            makeARequest(200, function (err, resp) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(Object.keys(resp.fieldsToAuthorize).length, 2);

                assert.strictEqual(resp.fieldsToAuthorize.gender, userGender);
                assert.strictEqual(resp.fieldsToAuthorize.profil_photo, profilPhotoURL);

                assert.ok(resp.fieldsToShow.indexOf('profil_photo') === -1);

                done();
            });
        });
    });

    it('sets profil photo to field to authorize '
       + 'when its the sole field to show', function (done) {

        var formData = validFormData(formFieldsMatchingFullScope);

        singularScope.forEach(function (field) {
            if (field === 'date_of_birth') {
                user.date_of_birth = new Date();

                return;
            }

            user[field] = formData[field];
        });

        user.profil_photo = undefined;

        user.save(function (err, user) {
            if (err) {
                return done(err);
            }
            
            makeARequest(200, function (err, resp) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(resp.fieldsToShow.length, 0);
                assert.strictEqual(resp.hasUserFieldsToShow, false);

                assert.strictEqual(Object.keys(resp.fieldsToAuthorize).length, singularScope.length);

                assert.ok(!!resp.fieldsToAuthorize.profil_photo.match(/\/users\/profil-photos\/default$/));

                done();
            });
        });
    });
    
    it('doesn\'t set profil photo to field to authorize '
       + 'when its not the sole field to show', function (done) {
        
        singularScope.forEach(function (field) {
            user[field] = undefined;
        });

        user.save(function (err, user) {
            if (err) {
                return done(err);
            }
            
            makeARequest(200, function (err, resp) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(resp.fieldsToShow.length, singularScope.length);
                assert.strictEqual(resp.hasUserFieldsToShow, true);

                assert.strictEqual(Object.keys(resp.fieldsToAuthorize).length, 0);

                done();
            });
        });
    });
});