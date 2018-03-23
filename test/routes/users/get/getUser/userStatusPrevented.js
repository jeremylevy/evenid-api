var request = require('supertest');
var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var oauthAuthorizeBeforeHook = require('../../../../../testUtils/tests/oauthAuthorizeBeforeHook');
var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var updateUser = require('../../../../../testUtils/users/update');

var makeARequest = null;
var app = null;

var authorizeAnotherClient = function (getOauthClientAccessTokenResp, cb) {
    var user = getOauthClientAccessTokenResp.user;
    var accessToken = getOauthClientAccessTokenResp.appAccessToken;

    async.auto({
        // We want to authorize 
        // another client for same user
        oauthAuthorizeBeforeHook: function (cb) {
            oauthAuthorizeBeforeHook.call({
                user: user,
                accessToken: accessToken
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        },

        // Authorize another 
        // client for same user
        getOauthClientAccessToken: ['oauthAuthorizeBeforeHook', function (cb, results) {
            var resp = results.oauthAuthorizeBeforeHook;

            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: resp
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        }],

        // We want to pass from 
        // `new_user` to `existing_user`
        getUser: ['getOauthClientAccessToken', function (cb, results) {
            var resp = results.getOauthClientAccessToken;

            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.fakeUserID
            }, 200, function (err, user) {
                if (err) {
                    return cb(err);
                }

                cb(null, user);
            });
        }]
    }, function (err, results) {
        var getOauthClientAccessTokenResp = results.getOauthClientAccessToken;

        if (err) {
            return cb(err);
        }

        cb(null, getOauthClientAccessTokenResp);
    });
};

var testUpdatingUser = function (expectedStatus, cb) {
    var context = this;
    var getOauthClientAccessTokenResp = context.getOauthClientAccessTokenResp;
    var update = {};

    context.singularFields.forEach(function (singularField) {
        update[singularField] = mongoose.Types.ObjectId().toString();

        if (singularField === 'gender') {
            update[singularField] = 'male';
        }

        if (singularField === 'date_of_birth') {
            update.date_of_birth_month = '12';
            update.date_of_birth_day = '17';
            update.date_of_birth_year = '1942';
        }

        if (['place_of_birth', 'nationality'].indexOf(singularField) !== -1) {
            update[singularField] = 'IT';
        }

        if (singularField === 'timezone') {
            update[singularField] = 'Europe/Paris';
        }
    });

    async.auto({
        // Authorize another client for which user 
        // status update will not be prevented
        authorizeAnotherClient: function (cb) {
            authorizeAnotherClient(getOauthClientAccessTokenResp,
                                   function (err, resp) {
                
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        },

        updateUser: ['authorizeAnotherClient', function (cb, results) {
            updateUser(context.appAccessToken,
                       context.realUserID, 
                       update, function (err, resp) {
                
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        }],

        getUser: ['updateUser', function (cb, results) {
            makeARequest.call(context, 200, function (err, user) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(user.status, expectedStatus);

                if (expectedStatus === 'new_user') {
                    assert.strictEqual(user.updated_fields.length, 0);
                }

                cb();
            });
        }],

        getUserForOtherClient: ['updateUser', function (cb, results) {
            var authorizeAnotherClientResp = results.authorizeAnotherClient;

            makeARequest.call({
                accessToken: authorizeAnotherClientResp.accessToken,
                userID: authorizeAnotherClientResp.fakeUserID
            }, 200, function (err, user) {
                if (err) {
                    return cb(err);
                }

                assert.strictEqual(user.status, 'existing_user_after_update');
                assert.ok(user.updated_fields.length > 0);

                cb();
            });
        }]
    }, function (err, results) {
        if (err) {
            return cb(err);
        }

        cb(null);
    });
};

var testWithTestUser = function (cb) {
    async.auto({
        authorizeClientForUser: function (cb) {
            getOauthClientAccessToken.call({
                useTestAccount: true
            }, function (err, resp) {
                if (err) {
                    return cb(err);
                }

                cb(null, resp);
            });
        }
    }, function (err, results) {
        var authorizeClientForUserResp = results && results.authorizeClientForUser;

        if (err) {
            return cb(err);
        }

        cb(null, authorizeClientForUserResp);
    });
};

describe('GET /users/:user_id (User status) (Prevented)', function () {
    before(function (done) {
        require('../../../../../index')(function (err, _app) {
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

                //cb(null, accessToken, userID);
            };

            updateUser = updateUser(app);

            done();
        });
    });
    
    it('prevents passing from `new_user` '
       + 'to `existing_user` when user is not get', function (done) {

        // User register first time with client
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            // User login another time 
            // without client calling the GET method
            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                // We need to set flow to `login`
                registeredUser: true
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

                    assert.strictEqual(user.status, 'new_user');
                    assert.strictEqual(user.updated_fields.length, 0);

                    done();
                });
            });
        });
    });

    it('prevents passing from `new_user` '
       + 'to `existing_user_after_update`', function (done) {

        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            testUpdatingUser.call({
                getOauthClientAccessTokenResp: resp,
                singularFields: resp.singularFields,
                appAccessToken: resp.appAccessToken,
                realUserID: resp.user.id,
                accessToken: resp.accessToken,
                userID: resp.fakeUserID 
            }, 'new_user', done);
        });
    });

    it('prevents passing from `existing_user_after_test` '
       + 'to `existing_user_after_update`', function (done) {

        async.auto({
            // User use a test account here: `new_user`
            useTestAccount: function (cb) {
                testWithTestUser(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            },

            // This method will call the GET users api method
            // and update the oauth user status from `new_user` 
            // to `existing_user` to allow passing to `existing_user_after_test`
            getUser: ['useTestAccount', function (cb, results) {
                var useTestAccountResp = results.useTestAccount;

                makeARequest.call({
                    accessToken: useTestAccountResp.accessToken,
                    userID: useTestAccountResp.fakeUserID
                }, 200, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            // From `existing_user` to `existing_user_after_test`
            authorizeClientToUser: ['getUser', function (cb, results) {
                var useTestAccountResp = results.useTestAccount;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: useTestAccountResp.oauthAuthBeforeHookResp
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var authorizeClientToUserResp = results && results.authorizeClientToUser;

            if (err) {
                return done(err);
            }

            // Try to pass to `existing_user_after_update`
            testUpdatingUser.call({
                getOauthClientAccessTokenResp: authorizeClientToUserResp,
                singularFields: authorizeClientToUserResp.singularFields,
                appAccessToken: authorizeClientToUserResp.appAccessToken,
                realUserID: authorizeClientToUserResp.user.id,
                accessToken: authorizeClientToUserResp.accessToken,
                userID: authorizeClientToUserResp.fakeUserID
            }, 'existing_user_after_test', done);
        });
    });

    it('prevents passing from `new_user` '
       + 'to `existing_user_after_test`', function (done) {

        // `new_user`
        testWithTestUser(function (err, resp) {
            var parsedQS = null;

            if (err) {
                return done(err);
            }

            // Try to pass to `existing_user_after_test`
            getOauthClientAccessToken.call({
                oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp
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

                    // Make sure it was prevented
                    assert.strictEqual(user.status, 'new_user');

                    done();
                });
            });
        });
    });
});