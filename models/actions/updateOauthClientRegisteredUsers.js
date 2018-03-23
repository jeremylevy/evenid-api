var assert = require('assert');
var Type = require('type-of-is');

var async = require('async');
var moment = require('moment-timezone');

var config = require('../../config');

var db = require('../');

var areValidObjectIDs = require('../validators/areValidObjectIDs')
                               (config.EVENID_MONGODB
                                      .OBJECT_ID_PATTERN);

module.exports = function (userID, clientID, nb, cb) {
    assert.ok(areValidObjectIDs([userID]),
              'argument `userID` must be an ObjectID');
    
    assert.ok(areValidObjectIDs([clientID]),
              'argument `clientID` must be an ObjectID');

    assert.ok(Type.is(nb, Number)
              && ((nb % 1) === 0) 
              && nb !== 0,
              'argument `nb` is a number');

    assert.ok(Type.is(cb, Function),
              'argument `cb` must be a function');

    var today = moment.tz(new Date(), 'UTC')
                      .startOf('day')
                      .toDate();

    var userOwnClientErr = new Error();

    userOwnClientErr.name = 'user_own_client';

    async.auto({
        assertUserDoesntOwnClient: function (cb) {
            db.models.User.findOne({
                _id: userID,
                'developer.clients': clientID
            }, function (err, user) {
                if (err) {
                    return cb(err);
                }

                if (user) {
                    return cb(userOwnClientErr);
                }

                cb(null);
            });
        },

        updateOauthClient: ['assertUserDoesntOwnClient', function (cb) {
            db.models.OauthClient.findByIdAndUpdate(clientID, {
                $inc: {
                    'statistics.registered_users': nb
                }
            }, {
                select: 'statistics'
            }, function (err, oldOauthClient) {
                if (err) {
                    return cb(err);
                }

                cb(null, oldOauthClient);
            });
        }],

        updateOauthClientRegisteredUsers: ['updateOauthClient', function (cb, results) {
            var oldOauthClient = results.updateOauthClient;

            var previousCount = oldOauthClient.statistics.registered_users || 0;
            var newCount = previousCount + nb;
            
            db.models.OauthClientRegisteredUser.update({
                client: clientID,
                at: today
            }, {
                count: newCount,
                // Previous count must be
                // previous day count
                $setOnInsert: {
                    previous_count: previousCount
                }
            }, {
                // Whether to create the doc 
                // if it doesn't exist
                upsert: true
            }, function (err, rawResponse) {
                if (err) {
                    return cb(err);
                }

                cb(null, newCount);
            });
        }]
    }, function (err, results) {
        var newCount = results && results.updateOauthClientRegisteredUsers;

        if (err) {
            if (err.name === 'user_own_client') {
                return cb(null);
            }
            
            return cb(err);
        }

        cb(null, newCount);
    });
};