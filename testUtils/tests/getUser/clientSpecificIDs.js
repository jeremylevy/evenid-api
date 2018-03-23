var assert = require('assert');
var request = require('supertest');

var async = require('async');

var getOauthClientAccessToken = require('../../getOauthClientAccessToken');

var CreateAddress = require('../../users/createAddress');

var assertUserContainsClientSpecificIDs = require('../../lib/assertUserContainsClientSpecificIDs');

module.exports = function (useTestAccount) {
    var desc = 'GET /users/:user_id (Client specific IDs)';

    if (useTestAccount) {
        desc += ' (Use test acccount)';
    }
    
    describe(desc, function () {
        var makeARequest = null;
        var app = null;

        before(function (done) {
            require('../../../index')(function (err, _app) {
                if (err) {
                    return done(err);
                }

                app = _app;
                
                makeARequest = function (statusCode, done) {
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

                    if (this.accessToken) {
                        return cb(null, this.accessToken, this.userID);
                    }

                    cb(null, accessToken, userID);
                };

                done();
            });
        });
        
        it('returns client specific user ID and '
           + 'entities ID the first time user register', function (done) {

            // User register first time with client
            getOauthClientAccessToken.call({
                useTestAccount: !!useTestAccount
            }, function (err, resp) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: resp.accessToken,
                    userID: resp.fakeUserID
                }, 200, function (err, user) {
                    if (err) {
                        return done(err);
                    }

                    assertUserContainsClientSpecificIDs(resp.client.id, 
                                                        resp.user.id, 
                                                        user, done);
                });
            });
        });
    });
};