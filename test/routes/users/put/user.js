var assert = require('assert');
var request = require('supertest');

var async = require('async');
var mongoose = require('mongoose');

var config = require('../../../../config');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');
var getOauthClientAccessToken = require('../../../../testUtils/getOauthClientAccessToken');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var findUsers = require('../../../../testUtils/db/findUsers');
var updateUser = require('../../../../testUtils/users/update');

var makeARequest = null;
var app = null;

var profilPhotoURL = config.EVENID_AWS.CLOUDFRONT.URLS.UPLOADS
                   + '/users/profil-photos'
                   + '/034e38fcafd01c52242d406625d9d33eaea35263';

var successReg = new RegExp('(?=.*id)(?=.*is_test_account)'
                          + '(?=.*first_name)(?=.*last_name)'
                          + '(?=.*nickname)(?=.*profil_photo)'
                          + '(?=.*gender)(?=.*date_of_birth)'
                          + '(?=.*place_of_birth)(?=.*nationality)'
                          + '(?=.*timezone)'
                          + '(?!.*password)'
                          + '(?!.*"_id")'
                          + '(?!.*"__v")');
    
describe('PUT /users/:user_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            updateUser = updateUser(app);
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, userID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .put('/users/' + (this.wrongUserID || userID))
                        // Body parser middleware needs it to populate `req.body`
                        .set('Content-Type', 'application/x-www-form-urlencoded')
                        .set('Authorization', authHeader)
                        .send(data)
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

                getAppAccessToken(function (err, accessToken, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, accessToken, user.id);
                });
            };

            getNonAppAccessToken = getNonAppAccessToken(app);
            getAppAccessToken = getAppAccessToken(app);

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
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` '
       + 'error when wrong access token', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: user.id
            }, 400, {}, /invalid_token/, done);
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
                }, 400, {}, /expired_token/, done);
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
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when non-app token try to update user', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            getNonAppAccessToken(function (err, accessToken, resp) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: resp.fakeUserID
                }, 403, {
                    first_name: 'John'
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` '
       + 'error when user try to update another user', function (done) {

        getAppAccessToken(function (err, accessToken, user) {
            if (err) {
                return done(err);
            }

            getAppAccessToken(function (err, accessToken) {
                if (err) {
                    return done(err);
                }

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 403, {
                   first_name: 'John'
                }, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error '
       + 'when attempt to modify user which does not exist', function (done) {

        makeARequest.call({
            wrongUserID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {
            first_name: 'John'
        }, /access_denied/, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when invalid user infos', function (done) {
        
        var reg = new RegExp('(?=.*invalid_request)'
                             + '(?=.*nickname)'
                             + '(?=.*first_name)(?=.*last_name)'
                             + '(?=.*date_of_birth)(?=.*place_of_birth)'
                             + '(?=.*nationality)(?=.*timezone)(?=.*gender)');

        makeARequest(400, {
            // '+2': for first and last elements
            first_name: new Array(config.EVENID_USERS.MAX_LENGTHS.FIRST_NAME + 2).join('a'),
            last_name: new Array(config.EVENID_USERS.MAX_LENGTHS.LAST_NAME + 2).join('a'),
            nickname: new Array(config.EVENID_USERS.MAX_LENGTHS.NICKNAME + 2).join('a'),
            gender: 'bar',
            date_of_birth_month: 'bar',
            date_of_birth_day: '18',
            date_of_birth_year: '1992',
            place_of_birth: 'bar',
            nationality: 'bar',
            timezone: 'bar'
        }, reg, done);
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when user wants taken nickname', function (done) {
        
        var reg = new RegExp('(?=.*invalid_request)'
                           + '(?=.*nickname)(?=.*already used)');
        var nickname = mongoose.Types.ObjectId().toString();

        async.auto({
            createAnotherUser : function (cb) {
                getAppAccessToken(function (err, accessToken, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        user: user
                    });
                });
            },

            setNickname: ['createAnotherUser', function (cb, results) {
                var accessToken = results.createAnotherUser.accessToken;
                var userID = results.createAnotherUser.user.id;

                updateUser(accessToken, userID, {nickname: nickname}, function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }]
        }, function (err, user) {
            if (err) {
                return done(err);
            }

            makeARequest(400, {
                nickname: nickname
            }, reg, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_request` '
       + 'error when client wants user field and user remove it', function (done) {

        var reg = new RegExp('(?=.*invalid_request)'
                           + '(?=.*first_name)(?=.*last_name)'
                           + '(?=.*nickname)(?=.*gender)'
                           + '(?=.*date_of_birth)(?=.*place_of_birth)'
                           + '(?=.*nationality)(?=.*timezone)'
                           + '(?!.*password)'
                           + '(?!.*"_id")'
                           + '(?!.*"__v")');
        
        getOauthClientAccessToken(function (err, resp) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: resp.appAccessToken,
                userID: resp.user.id
            }, 400, {
                first_name: '',
                last_name: '',
                nickname: '', 
                gender: '', 
                date_of_birth_month: '',
                date_of_birth_day: '',
                date_of_birth_year: '',
                place_of_birth: '',
                nationality: '',
                timezone: ''
            }, reg, done);
        });
    });

    it('responds with HTTP code 200 and '
       + 'replace empty string by `undefined` '
       + 'when no clients want removed fields', function (done) {

        var updatedUser = {
            first_name: '',
            last_name: '',
            nickname: '', 
            gender: '', 
            date_of_birth_month: '',
            date_of_birth_day: '',
            date_of_birth_year: '',
            place_of_birth: '',
            nationality: '',
            timezone: ''
        };

        var assertUserWasUpdated = function (user, updatedUser) {
            Object.keys(updatedUser).forEach(function (key) {
                if (key.match(/^date_of_birth_/)) {
                    key = 'date_of_birth';
                }

                assert.strictEqual(user[key], undefined);
            });
        };
        
        async.auto({
            updateUser: function (cb) {
                makeARequest(200, updatedUser, /.+/, function (err, resp) {
                    var user = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    assertUserWasUpdated(user, updatedUser);

                    cb(null, user);
                });
            },

            assertUserWasUpdated: ['updateUser', function (cb, results) {
                var user = results.updateUser;

                findUsers([user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    assertUserWasUpdated(user, updatedUser);

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
    
    // Avoid date of birth "must be set error"
    // when client wants date of birth 
    // and user update profil photo (only profil photo was sent)
    // (Added after a BUG)
    it('responds with HTTP code 200 and user when client '
       + 'wants date of birth and only profil photo was updated', function (done) {
        
        var successReg = new RegExp('(?=.*id)'
                                  + '(?=.*profil_photo)'
                                  + '(?!.*password)'
                                  + '(?!.*"_id")'
                                  + '(?!.*"__v")');

        async.auto({
            getOauthClientAccessToken: function (cb) {
                getOauthClientAccessToken(function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: resp.appAccessToken,
                        userID: resp.user.id
                    });
                });
            },

            updateProfilPhoto: ['getOauthClientAccessToken', function (cb, results) {
                var getOauthClientAccessTokenResp = results.getOauthClientAccessToken;
                var accessToken = getOauthClientAccessTokenResp.accessToken;
                var userID = getOauthClientAccessTokenResp.userID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID
                }, 200, {
                    profil_photo: profilPhotoURL
                }, successReg, function (err, resp) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertProfilPhotoWasUpdated: ['updateProfilPhoto', function (cb, results) {
                var getOauthClientAccessTokenResp = results.getOauthClientAccessToken;
                var userID = getOauthClientAccessTokenResp.userID;

                findUsers([userID], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    assert.strictEqual(user.profil_photo, profilPhotoURL);

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

    it('responds with HTTP code 200 and user when '
       + 'valid user infos', function (done) {

        var updatedUser = {
            first_name: mongoose.Types.ObjectId().toString(),
            last_name: mongoose.Types.ObjectId().toString(),
            nickname: mongoose.Types.ObjectId().toString(), 
            gender: 'male', 
            date_of_birth_month: '05',
            date_of_birth_day: '18',
            date_of_birth_year: '1992',
            place_of_birth: 'FR',
            nationality: 'FR',
            timezone: 'Europe/Paris'
        };

        var assertUserWasUpdated = function (user, updatedUser) {
            Object.keys(updatedUser).forEach(function (key) {
                var dateOfBirth = user.date_of_birth;

                if (key.match(/^date_of_birth_/)) {
                    // String or object
                    if (dateOfBirth.toISOString) {
                        dateOfBirth = dateOfBirth.toISOString();
                    }

                    assert.strictEqual(dateOfBirth, new Date(
                        updatedUser.date_of_birth_year,
                        // Beginning with 0
                        updatedUser.date_of_birth_month - 1,
                        updatedUser.date_of_birth_day
                    ).toISOString());
                    
                    return;
                }

                assert.strictEqual(user[key], updatedUser[key]);
            });
        };
        
        async.auto({
            createUser: function (cb) {
                getAppAccessToken(function (err, accessToken, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        user: user
                    });
                });
            },

            updateUser: ['createUser', function (cb, results) {
                var createUserResp = results.createUser;
                var accessToken = createUserResp.accessToken;
                var user = createUserResp.user;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: user.id
                }, 200, updatedUser, successReg, function (err, resp) {
                    var user = resp && resp.body;

                    if (err) {
                        return cb(err);
                    }

                    assertUserWasUpdated(user, updatedUser);

                    cb();
                });
            }],

            assertUserWasUpdated: ['updateUser', function (cb, results) {
                var createUserResp = results.createUser;
                var user = createUserResp.user;

                findUsers([user.id], function (err, users) {
                    var user = users[0];

                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(users.length, 1);

                    assertUserWasUpdated(user, updatedUser);

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