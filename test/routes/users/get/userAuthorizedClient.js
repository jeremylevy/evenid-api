var assert = require('assert');
var request = require('supertest');

var Type = require('type-of-is');

var config = require('../../../../config');

var areValidObjectIDs = require('../../../../models/validators/areValidObjectIDs')
                                (config.EVENID_MONGODB.OBJECT_ID_PATTERN);

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var createAuthorizedClient = require('../../../../testUtils/users/createAuthorizedClient');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var makeARequest = null;
var app = null;
    
describe('GET /users/:user_id/authorized-clients/:authorized_client_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, body, done) {
                var cb = function (err, accessToken, userID, authorizedClientID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .get('/users/' + userID 
                             + '/authorized-clients/' 
                             + (this.wrongAuthorizedClientID || authorizedClientID))
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
                    return cb(null, this.accessToken, this.userID, this.authorizedClientID);
                }

                createAuthorizedClient(cb);
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

            done();
        });
    });
    
    it('responds with HTTP code 400 and `invalid_request` error when '
       + 'wrong authorization header', function (done) {
        
        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: accessToken,
                authHeader: 'Bearer  ' + accessToken,
                userID: userID,
                authorizedClientID: authorizedClientID
            }, 400, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {
        
        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                authorizedClientID: authorizedClientID
            }, 400, /invalid_token/, done);
        });
    });

    it('responds with HTTP code 400 and `expired_token` error when '
       + 'expired access token', function (done) {
        
        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            if (err) {
                return done(err);
            }

            expireOauthAccessToken(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    authorizedClientID: authorizedClientID
                }, 400, /expired_token/, done);
            });
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'access token does not have authorization', function (done) {
        
        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            if (err) {
                return done(err);
            }

            unsetOauthAccessTokenAuthorization(accessToken, function (err) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    authorizedClientID: authorizedClientID
                }, 400, /invalid_token/, done);
            });
        });
    });
    
    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to get user authorized client', function (done) {
        
        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    authorizedClientID: authorizedClientID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to get authorized client which does not belong to him', function (done) {
        
        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    authorizedClientID: authorizedClientID
                }, 403, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to get invalid user authorized client', function (done) {
        
        makeARequest.call({
            wrongAuthorizedClientID: '507c7f79bcf86cd7994f6c0e'
        }, 403, /(?=.*error)/, done);
    });

    it('responds with HTTP code 200 and user authorized client when '
       + 'getting valid user authorized client', function (done) {

        getOauthClientAccessToken(function (err, resp) {
            // Positive lookahead assertion - Negative lookahead assertion
            var reg = new RegExp('(?=.*client)(?=.*id)(?=.*name)'
                                 + '(?=.*description)(?=.*logo)'
                                 + '(?=.*facebook_username)(?=.*twitter_username)'
                                 + '(?=.*instagram_username)'
                                 + '(?=.*authorizedUser)(?=.*emails)'
                                 + '(?=.*full_name)'
                                 + '(?=.*nickname)(?=.*profil_photo)'
                                 + '(?=.*gender)(?=.*date_of_birth)'
                                 + '(?=.*nationality)(?=.*timezone)'
                                 + '(?=.*addresses)(?=.*phone_numbers)'
                                 + '(?!.*"_id")(?!.*"__v")'
                                 + '(?!.*"client_id")(?!.*"client_secret")');

            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: resp.appAccessToken,
                userID: resp.user.id,
                authorizedClientID: resp.client.id
            }, 200, reg, function (err, resp) {
                var authorizedClientResp = resp.body || {};
                var client = authorizedClientResp.client;
                var user = authorizedClientResp.authorizedUser;

                if (err) {
                    return done(err);
                }

                // {client: {...}, authorizedUser: {...}}
                assert.ok(Type.is(authorizedClientResp, Object)
                          && Object.keys(authorizedClientResp).length === 2);

                assert.ok(areValidObjectIDs([client.id]));

                assert.ok(Type.is(client.name, String) && client.name.length > 0);
                assert.ok(Type.is(client.description, String) && client.description.length > 0);
                assert.ok(Type.is(client.website, String) && client.website.length > 0);
                
                assert.ok(Type.is(client.logo, String) 
                          && !!client.logo.match(new RegExp(
                            '^'
                            + config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS
                            + '/clients/logos/' 
                            + config.EVENID_UPLOADS.HASH.PATTERN
                            + '$'
                          )));
                
                /* Optional properties */

                assert.ok(Type.is(client.facebook_username, String));
                assert.ok(Type.is(client.twitter_username, String));
                assert.ok(Type.is(client.instagram_username, String));

                /* Received user depends on authorized scope */

                assert.ok(Type.is(user.full_name, String) 
                          && user.full_name.length > 0);

                assert.ok(Type.is(user.nickname, String) 
                          && user.nickname.length > 0);

                // Gravatar
                assert.ok(Type.is(user.profil_photo, String) 
                          && !!user.profil_photo.match(new RegExp(
                                '^' + config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS 
                                    + '/users/profil-photos/default'
                              + '$'
                          )));

                assert.ok(Type.is(user.gender, String) 
                          && ['male', 'female'].indexOf(user.gender) !== -1);

                assert.ok(Type.is(user.date_of_birth, String) 
                          && user.date_of_birth.length > 0);

                assert.ok(Type.is(user.place_of_birth, String) 
                          && user.place_of_birth.length > 0);

                assert.ok(Type.is(user.nationality, String) 
                          && user.nationality.length > 0);

                assert.ok(Type.is(user.timezone, String) 
                          && user.timezone.length > 0);

                assert.ok(Type.is(user.emails, Array));
                assert.strictEqual(user.emails.length, 1);

                assert.ok(Type.is(user.phone_numbers, Array));
                assert.strictEqual(user.phone_numbers.length, 2);

                assert.ok(Type.is(user.addresses, Array));
                assert.strictEqual(user.addresses.length, 2);

                done();
            });
        });
    });
});