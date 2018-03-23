var assert = require('assert');
var request = require('supertest');

var mongoose = require('mongoose');
var async = require('async');

var moment = require('moment');

var getNonAppAccessToken = require('../../../../testUtils/getNonAppAccessToken');
var getAppAccessToken = require('../../../../testUtils/getAppAccessToken');

var createOauthEntityID = require('../../../../testUtils/db/createOauthEntityID');
var findOauthClients = require('../../../../testUtils/db/findOauthClients');

var findOauthEntitiesID = require('../../../../testUtils/db/findOauthEntitiesID');
var findOauthUserEvents = require('../../../../testUtils/db/findOauthUserEvents');

var createAuthorizedClient = require('../../../../testUtils/users/createAuthorizedClient');
var findLastOauthNotification = require('../../../../testUtils/db/findLastOauthNotification');

var createOauthHook = require('../../../../testUtils/clients/createHook');
var findUserAuthorizations = require('../../../../testUtils/db/findUserAuthorizations');

var expireOauthAccessToken = require('../../../../testUtils/db/expireOauthAccessToken');
var unsetOauthAccessTokenAuthorization = require('../../../../testUtils/db/unsetOauthAccessTokenAuthorization');

var authorizeAnotherUserForClient = require('../../../../testUtils/authorizeAnotherUserForClient');
var updateOauthClientRegisteredUsers = require('../../../../testUtils/db/updateOauthClientRegisteredUsers');

var findOauthClientRegisteredUsersAtDate = require('../../../../testUtils/db/findOauthClientRegisteredUsersAtDate');
var assertRegisteredUsersNb = require('../../../../testUtils/validators/assertOauthClientRegisteredUsersNb');

var findOauthNotifications = require('../../../../testUtils/db/findOauthNotifications');

var makeARequest = null;
var app = null;

describe('DELETE /users/:user_id/authorized-clients/:authorized_client_id', function () {
    before(function (done) {
        require('../../../../index')(function (err, _app) {
            if (err) {
                return done(err);
            }

            app = _app;
            
            makeARequest = function (statusCode, data, body, done) {
                var cb = function (err, accessToken, userID, authorizedClientID) {
                    if (err) {
                        return done(err);
                    }

                    var authHeader = this.authHeader || 'Bearer ' + accessToken;

                    request(app)
                        .delete('/users/' + (this.wrongUserID || userID) 
                                + '/authorized-clients/' 
                                + (this.wrongAuthorizedClientID || authorizedClientID))
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
            }, 400, {}, /invalid_request/, done);
        });
    });

    it('responds with HTTP code 400 and `invalid_token` error when '
       + 'wrong access token', function (done) {

        createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
            if (err) {
                return done(err);
            }

            makeARequest.call({
                accessToken: '9fb8fb2a941ffe8d3f020e6c80eee47e61d8e368',
                userID: userID,
                authorizedClientID: authorizedClientID
            }, 400, {}, /invalid_token/, done);
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
                }, 400, {}, /expired_token/, done);
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
                }, 400, {}, /invalid_token/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'non-app token try to delete authorized client', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete authorized client for invalid user', function (done) {

        makeARequest.call({
            wrongUserID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'user try to delete authorized client which does not belong to him', function (done) {

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
                }, 403, {}, /access_denied/, done);
            });
        });
    });

    it('responds with HTTP code 403 and `access_denied` error when '
       + 'attempt to delete invalid authorized client', function (done) {

        makeARequest.call({
            wrongAuthorizedClientID: '507c7f79bcf86cd7994f6c0e'
        }, 403, {}, /access_denied/, done);
    });

    it('responds with HTTP code 200 when '
       + 'deleting valid authorized client', function (done) {
        
        async.auto({
            createAuthorizedClient: function (cb) {
                createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        authorizedClientID: authorizedClientID
                    });
                });
            },

            assertAuthorizedClientWasCreated: ['createAuthorizedClient', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var userID = createAuthorizedClientResp.userID;
                
                findUserAuthorizations([userID], function (err, authorizedClients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(authorizedClients.length, 1);

                    cb();
                });
            }],

            updateOauthClientRegisteredUsers: ['assertAuthorizedClientWasCreated', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;

                var authorizedClientID = createAuthorizedClientResp.authorizedClientID;
                var userID = createAuthorizedClientResp.userID;

                updateOauthClientRegisteredUsers(userID, authorizedClientID, 1, cb);
            }],

            // Used to find oauth notifications.
            // Need to be set before deauthorization
            // given that entities ID will be removed.
            findOauthUserID: ['updateOauthClientRegisteredUsers', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                
                var userID = createAuthorizedClientResp.userID;
                var authorizedClientID = createAuthorizedClientResp.authorizedClientID;

                findOauthEntitiesID({
                    client: authorizedClientID,
                    user: userID,
                    entities: ['users']
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesID.length, 1);

                    cb(null, oauthEntitiesID[0]);
                });
            }],

            deleteAuthorizedClient: ['findOauthUserID', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var userID = createAuthorizedClientResp.userID;
                
                var accessToken = createAuthorizedClientResp.accessToken;
                var authorizedClientID = createAuthorizedClientResp.authorizedClientID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    authorizedClientID: authorizedClientID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertAuthorizedClientWasDeleted: ['deleteAuthorizedClient', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var userID = createAuthorizedClientResp.userID;
                
                findUserAuthorizations([userID], function (err, authorizedClients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(authorizedClients.length, 0);

                    cb();
                });
            }],

            assertOauthNotificationsWereNotUpdated: ['deleteAuthorizedClient', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;

                var authorizedClientID = createAuthorizedClientResp.authorizedClientID;
                var oauthUserID = results.findOauthUserID;

                findOauthNotifications([authorizedClientID],
                                       [oauthUserID.fake_id],
                                       function (err, oauthUserStatues) {
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserStatues.length, 0);

                    cb(null);
                });
            }],

            assertNotificationWasNotSetInSQS: ['deleteAuthorizedClient', function (cb, results) {
                findLastOauthNotification(function (err, oauthNotification) {
                    if (err) {
                        return cb(err);
                    }

                    assert.ok(!oauthNotification);

                    cb(null);
                });
            }],

            assertRegisteredUsersWereNotUpdated: ['deleteAuthorizedClient', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;

                var clientID = createAuthorizedClientResp.authorizedClientID;

                assertRegisteredUsersNb(clientID, 1, cb);
            }],

            assertRegisteredUsersWereUpdatedForNonClientOwner: ['deleteAuthorizedClient', function (cb, results) {
                authorizeAnotherUserForClient(function (err, results) {
                    var accessToken = null;
                    var userID = null;
                    var authorizedClientID = null;

                    if (err) {
                        return cb(err);
                    }

                    authorizedClientID = results.getOauthClientAccessToken.client.id;
                    userID = results.authorizeAnotherUser.accessToken.user_id;
                    accessToken = results.authorizeAnotherUser.accessToken.access_token;

                    // Make sure registered 
                    // users count is equals to 1
                    assertRegisteredUsersNb(authorizedClientID, 1, function (err) {
                        if (err) {
                            return cb(err);
                        }

                        makeARequest.call({
                            accessToken: accessToken,
                            userID: userID,
                            authorizedClientID: authorizedClientID
                        }, 200, {}, '{}', function (err) {
                            if (err) {
                                return cb(err);
                            }

                            // Make sure it was updated after deletion
                            assertRegisteredUsersNb(authorizedClientID, 0, cb);
                        });
                    });
                });
            }],

            assertEventWasNotInsertedForClientOwner: ['deleteAuthorizedClient', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;

                var clientID = createAuthorizedClientResp.authorizedClientID;
                var userID = createAuthorizedClientResp.userID;

                findOauthUserEvents({
                    client: clientID,
                    user: userID,
                    type: 'deregistration'
                }, function (err, events) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(events.length, 0);

                    cb(null);
                });
            }],

            assertEventWasInsertedForNonClientOwner: ['deleteAuthorizedClient', function (cb, results) {
                authorizeAnotherUserForClient(function (err, results) {
                    var accessToken = null;
                    var userID = null;
                    var authorizedClientID = null;

                    if (err) {
                        return cb(err);
                    }

                    var authorizedClientID = results.getOauthClientAccessToken.client.id;
                    var userID = results.authorizeAnotherUser.accessToken.user_id;
                    var accessToken = results.authorizeAnotherUser.accessToken.access_token;

                    makeARequest.call({
                        accessToken: accessToken,
                        userID: userID,
                        authorizedClientID: authorizedClientID
                    }, 200, {}, '{}', function (err) {
                        if (err) {
                            return cb(err);
                        }

                        findOauthUserEvents({
                            client: authorizedClientID,
                            user: userID,
                            type: 'deregistration'
                        }, function (err, events) {
                            if (err) {
                                return cb(err);
                            }

                            assert.strictEqual(events.length, 1);

                            cb(null);
                        });
                    });
                });
            }]
        }, function (err, results) {
            if (err) {
                return done(err);
            }

            done();
        });
    });
    
    it('responds with HTTP code 200 '
       + 'and send revoke access notification '
       + 'when deleting valid authorized client', function (done) {

        var hookURL = 'http://bar.com';

        async.auto({
            createAuthorizedClient: function (cb) {
                createAuthorizedClient(function (err, accessToken, userID, authorizedClientID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, {
                        accessToken: accessToken,
                        userID: userID,
                        authorizedClientID: authorizedClientID
                    });
                });
            },

            addHook: ['createAuthorizedClient', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var accessToken = createAuthorizedClientResp.accessToken;
                var clientID = createAuthorizedClientResp.authorizedClientID;

                createOauthHook(app, function (cb) {
                    cb(null, accessToken, clientID);
                }).call({
                    url: hookURL,
                    event_type: 'USER_DID_REVOKE_ACCESS'
                }, function (err, accessToken, clientID, hookID) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, hookID);
                });
            }],

            // Make sure client 
            // secret sent match
            findClient: ['addHook', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var clientID = createAuthorizedClientResp.authorizedClientID;

                findOauthClients([clientID], function (err, oauthClients) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthClients.length, 1);

                    cb(null, oauthClients[0]);
                });
            }],

            // Make sure user id sent
            // is client specific id.
            // Needs to be set before the deletion
            // given that the oauth entities ID will be removed
            findOauthUserID: ['addHook', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var userID = createAuthorizedClientResp.userID;
                var clientID = createAuthorizedClientResp.authorizedClientID;

                findOauthEntitiesID({
                    client: clientID,
                    user: userID,
                    entities: ['users']
                }, function (err, oauthEntitiesID) {
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthEntitiesID.length, 1);

                    cb(null, oauthEntitiesID[0]);
                });
            }],

            deleteAuthorizedClient: ['findClient', 'findOauthUserID', function (cb, results) {
                var createAuthorizedClientResp = results.createAuthorizedClient;
                var userID = createAuthorizedClientResp.userID;
                var accessToken = createAuthorizedClientResp.accessToken;
                var authorizedClientID = createAuthorizedClientResp.authorizedClientID;

                makeARequest.call({
                    accessToken: accessToken,
                    userID: userID,
                    authorizedClientID: authorizedClientID
                }, 200, {}, '{}', function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            assertOauthNotificationsWereUpdated: ['deleteAuthorizedClient', function (cb, results) {
                var client = results.findClient;
                var oauthUserID = results.findOauthUserID;

                findOauthNotifications([client.id],
                                       [oauthUserID.fake_id],
                                       function (err, oauthUserStatues) {
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(oauthUserStatues.length, 1);

                    oauthUserStatues.forEach(function (oauthUserStatus) {
                        var pendingNotification = oauthUserStatus.pending_notifications[0];
                        
                        var notificationObj = pendingNotification && JSON.parse(pendingNotification.notification);
                        var notification = notificationObj && notificationObj.notification;

                        assert.strictEqual(notificationObj.client_secret,
                                           client.client_secret);

                        assert.strictEqual(notificationObj.handler_url,
                                           hookURL);

                        assert.strictEqual(notification.user_id.toString(),
                                           oauthUserID.fake_id.toString());

                        assert.strictEqual(notification.event_type,
                                           'user_did_revoke_access');
                    });

                    cb(null);
                });
            }],

            assertNotificationWasSetInSQS: ['deleteAuthorizedClient', function (cb, results) {
                var client = results.findClient;
                var oauthUserID = results.findOauthUserID;

                findLastOauthNotification(function (err, oauthNotification) {
                    var notifications = [];

                    if (err) {
                        return cb(err);
                    }

                    assert.ok(!!oauthNotification);

                    notifications = JSON.parse(oauthNotification.payload);

                    assert.strictEqual(notifications.length, 1);

                    notifications.forEach(function (notificationObj) {
                        assert.deepEqual(notificationObj, {
                            client_id: client.id,
                            user_id: oauthUserID.fake_id.toString()
                        });
                    });
                    
                    cb(null, oauthNotification);
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