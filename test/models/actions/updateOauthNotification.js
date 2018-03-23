var assert = require('assert');

var async = require('async');
var mongoose = require('mongoose');

var updateOauthNotification = require('../../../models/actions/updateOauthNotification');

var compareArray = require('../../../testUtils/lib/compareArray');

var createOauthNotification = require('../../../testUtils/db/createOauthNotification');
var findOauthNotifications = require('../../../testUtils/db/findOauthNotifications');

describe('models.actions.updateOauthNotification', function () {
    // Connect to database
    before(function (done) {
        require('../../../index')(function (err, app) {
            if (err) {
                return done(err);
            }

            done();
        });
    });

    it('throws an exception when passing invalid client ID', function () {
        [null, undefined, {}, ['bar', 'foo'], 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthNotification(v, 
                                        mongoose.Types.ObjectId(),
                                        {}, 
                                        function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid user ID', function () {
        [null, undefined, {}, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthNotification(mongoose.Types.ObjectId(), 
                                        v,
                                        {},
                                        function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing non-object value as update', function () {
        [null, undefined, 9, [], 'bar'].forEach(function (v) {
            assert.throws(function () {
                updateOauthNotification(mongoose.Types.ObjectId(), 
                                        mongoose.Types.ObjectId(),
                                        v,
                                        function () {});
            }, assert.AssertionError);
        });
    });

    it('throws an exception when passing invalid callback', function () {
        [null, undefined, {}, 9, [], ''].forEach(function (v) {
            assert.throws(function () {
                updateOauthNotification(mongoose.Types.ObjectId(), 
                                        mongoose.Types.ObjectId(),
                                        {},
                                        v);
            }, assert.AssertionError);
        });
    });

    it('creates valid notification if not exists', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        var firstPendingNotifications = [{
            notification: JSON.stringify([{
                client_id: clientID,
                user_id: userID
            }])
        }];

        async.auto({
            updateOauthNotification: function (cb) {
                updateOauthNotification(clientID, userID, {
                    pending_notifications: firstPendingNotifications
                }, cb);
            },

            findUpdatedOauthNotification: ['updateOauthNotification', function (cb) {
                findOauthNotifications.call({
                    // Get raw result to make sure `processed_at` 
                    // was really set 
                    // (ie: not the default value 
                    // applied by Mongoose)
                    lean: true
                }, [clientID], [userID], function (err, updatedOauthNotifications) {
                    
                    if (err) {
                        return cb(err);
                    }

                    assert.strictEqual(updatedOauthNotifications.length, 1);

                    cb(null, updatedOauthNotifications[0]);
                });
            }]
        }, function (err, results) {
            var updatedOauthNotification = results && results.findUpdatedOauthNotification;

            if (err) {
                return done(err);
            }

            /* Make sure notification was created */
            assert.strictEqual(updatedOauthNotification.pending_notifications.length, 1);

            assert.ok(compareArray(updatedOauthNotification.pending_notifications,
                                   firstPendingNotifications));

            // Make sure `processed_at` is set on insert
            assert.strictEqual(updatedOauthNotification.processed_at.getTime(),
                               new Date(0).getTime());

            done();
        }); 
    });

    it('prevents pending notifications overwrite when empty field', function (done) {
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        var firstPendingNotifications = [{
            notification: JSON.stringify([{
                client_id: clientID,
                user_id: userID
            }])
        }];

        async.auto({
            // First we need to create an oauth notification
            createOauthNotification: function (cb) {
                var pendingNotificationsAreProcessed = false;

                createOauthNotification(clientID, userID, {
                    pending_notifications: firstPendingNotifications
                }, pendingNotificationsAreProcessed, cb);
            },

            // Then we update it
            updateOauthNotification: ['createOauthNotification',
                                      function (cb) {
                
                updateOauthNotification(clientID, userID, {
                    /* Make sure it does not overwrite `pending_notifications` 
                       fields when empty array was passed */
                    pending_notifications: []
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            findUpdatedOauthNotification: ['updateOauthNotification', function (cb) {
                findOauthNotifications([clientID], 
                                       [userID], 
                                       function (err, updatedOauthNotifications) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedOauthNotifications[0]);
                });
            }]
        }, function (err, results) {
            var updatedOauthNotification = results && results.findUpdatedOauthNotification;

            if (err) {
                return done(err);
            }

            /* Make sure it does not overwrite `pending_notifications` 
               fields when empty array was passed */
            assert.strictEqual(updatedOauthNotification.pending_notifications.length, 1);

            assert.ok(compareArray(updatedOauthNotification.pending_notifications.toObject(),
                                   firstPendingNotifications));

            done();
        });
    });
    
    it('overwrites pending notification when empty '
       + 'field is sent with `$set` operator', function (done) {
        
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        async.auto({
            // First we need to create an oauth notification
            createOauthNotification: function (cb) {
                var pendingNotificationsAreProcessed = false;

                createOauthNotification(clientID, userID, {
                    pending_notifications: [{
                        notification: JSON.stringify([{
                            client_id: clientID,
                            user_id: userID
                        }])
                    }]
                }, pendingNotificationsAreProcessed, cb);
            },

            // Then we update it
            updateOauthNotification: ['createOauthNotification',
                                      function (cb) {
                
                updateOauthNotification(clientID, userID, {
                    /* Make sure it does overwrite `pending_notifications` 
                       fields when `$set` operator was used */
                    $set: {
                        pending_notifications: []
                    }
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            findUpdatedOauthNotification: ['updateOauthNotification', function (cb) {
                findOauthNotifications([clientID], 
                                       [userID], 
                                       function (err, updatedOauthNotifications) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedOauthNotifications[0]);
                });
            }]
        }, function (err, results) {
            var updatedOauthNotification = results && results.findUpdatedOauthNotification;

            if (err) {
                return done(err);
            }

            /* Make sure it does overwrite `pending_notifications` 
               field when `$set` operator was used */
            assert.strictEqual(updatedOauthNotification.pending_notifications.length, 0);

            done();
        });
    });

    it('updates oauth notification and '
       + 'push pending notifications', function (done) {
        
        var clientID = mongoose.Types.ObjectId();
        var userID = mongoose.Types.ObjectId();

        var clientID2 = mongoose.Types.ObjectId();
        var userID2 = mongoose.Types.ObjectId();

        var firstPendingNotifications = [{
            notification: JSON.stringify([{
                client_id: clientID,
                user_id: userID
            }])
        }];

        var secondPendingNotifications = [{
            notification: JSON.stringify([{
                client_id: clientID2,
                user_id: userID2
            }])
        }];

        var today = new Date();

        async.auto({
            // First we need to create an oauth notification
            createOauthNotification: function (cb) {
                var pendingNotificationsAreProcessed = false;

                createOauthNotification(clientID, userID, {
                    pending_notifications: firstPendingNotifications
                }, pendingNotificationsAreProcessed, cb);
            },

            // Then we update it
            updateOauthNotification: ['createOauthNotification', function (cb) {
                updateOauthNotification(clientID, userID, {
                    /* Make sure it update single field */
                    processed_at: today,

                    /* Make sure it push `pending_notification` field */
                    pending_notifications: secondPendingNotifications
                }, function (err) {
                    if (err) {
                        return cb(err);
                    }

                    cb();
                });
            }],

            findUpdatedOauthNotification: ['updateOauthNotification', function (cb) {
                findOauthNotifications([clientID], 
                                       [userID], 
                                       function (err, updatedOauthNotifications) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedOauthNotifications[0]);
                });
            }]
        }, function (err, results) {
            var updatedOauthNotification = results && results.findUpdatedOauthNotification;

            if (err) {
                return done(err);
            }

            /* Make sure it update single field */
            assert.strictEqual(updatedOauthNotification.processed_at.getTime(),
                               today.getTime());

            /* Make sure it push `pending_notification` field */
            assert.strictEqual(updatedOauthNotification.pending_notifications.length, 2);

            assert.ok(compareArray(updatedOauthNotification.pending_notifications.toObject(),
                                   firstPendingNotifications.concat(secondPendingNotifications)));

            done();
        });
    });
});