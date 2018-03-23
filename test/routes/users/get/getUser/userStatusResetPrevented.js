var request = require('supertest');
var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var getOauthClientAccessToken = require('../../../../../testUtils/getOauthClientAccessToken');

var updateUser = require('../../../../../testUtils/users/update');

var makeARequest = null;
var app = null;

var testUpdatingUser = function (cb) {
    var context = this;
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

    updateUser(context.appAccessToken,
               context.realUserID, 
               update, function (err, resp) {
        
        if (err) {
            return cb(err);
        }

        cb(null, resp);
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

describe('GET /users/:user_id (User status) (Reset prevented)', function () {
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

                cb(null, accessToken, userID);
            };

            updateUser = updateUser(app);

            done();
        });
    });
    
    it('prevents resetting user status from `new_user` '
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

    it('prevents resetting user status from `existing_user_after_update` '
       + 'to `existing_user` when user is not get', function (done) {

        async.auto({
            // First registration on client
            getOauthClientAccessToken: function (cb) {
                getOauthClientAccessToken(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            },

            // From `new_user` to `existing_user`
            getUser: ['getOauthClientAccessToken', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                makeARequest.call({
                    accessToken: resp.accessToken,
                    userID: resp.fakeUserID
                }, 200, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(user.status, 'new_user');
                    assert.strictEqual(user.updated_fields.length, 0);

                    cb();
                });
            }],

            // From `existing_user` to `existing_user_after_update`
            updateUser: ['getUser', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                testUpdatingUser.call({
                    singularFields: resp.singularFields,
                    appAccessToken: resp.appAccessToken,
                    realUserID: resp.user.id,
                    accessToken: resp.accessToken,
                    userID: resp.fakeUserID 
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            // Login another time on client 
            // without calling GET method in between
            loginAnotherTime: ['updateUser', function (cb, results) {
                var resp = results.getOauthClientAccessToken;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                    registeredUser: true
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var resp = results.getOauthClientAccessToken;

            if (err) {
                return done(err);
            }

            // Make sure status is not set to `existing_user`
            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.fakeUserID
            }, 200, function (err, user) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.status, 'existing_user_after_update');
                assert.ok(user.updated_fields.length > 0);

                done();
            });
        });
    });

    it('prevents resetting user status from `existing_user_after_test` '
       + 'to `existing_user` when user is not get', function (done) {

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
                var resp = results.useTestAccount;

                makeARequest.call({
                    accessToken: resp.accessToken,
                    userID: resp.fakeUserID
                }, 200, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }],

            // From `existing_user` to `existing_user_after_test`
            authorizeClientToUser: ['getUser', function (cb, results) {
                var resp = results.useTestAccount;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }],

            // Login another time on client 
            // without calling GET method in between
            loginAnotherTime: ['authorizeClientToUser', function (cb, results) {
                var resp = results.useTestAccount;

                getOauthClientAccessToken.call({
                    oauthAuthBeforeHookResp: resp.oauthAuthBeforeHookResp,
                    registeredUser: true
                }, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var resp = results && results.authorizeClientToUser;

            if (err) {
                return done(err);
            }

            // Make sure status is not set to `existing_user`
            makeARequest.call({
                accessToken: resp.accessToken,
                userID: resp.fakeUserID
            }, 200, function (err, user) {
                if (err) {
                    return done(err);
                }

                assert.strictEqual(user.status, 'existing_user_after_test');
                assert.ok(user.updated_fields.length > 0);

                done();
            });
        });
    });
});