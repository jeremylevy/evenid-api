var async = require('async');
var mongoose = require('mongoose');

var db = require('../../models');

var createUser = require('./createUser');
var createOauthClient = require('./createOauthClient');

module.exports = function (cb) {
    var context = this;

    async.auto({
        createUser: function (cb) {
            if (context.user) {
                return cb(null, context.user);
            }

            createUser(function (err, user) {
                if (err) {
                    return cb(err);
                }

                return cb(null, user);
            });
        },

        createOauthClient: function (cb) {
            if (context.client) {
                return cb(null, context.client);
            }

            createOauthClient(function (err, client) {
                if (err) {
                    return cb(err);
                }

                return cb(null, client);
            });
        },

        createUserAuthorization: ['createUser', 'createOauthClient', function (cb, results) {
            var user = results.createUser;
            var client = results.createOauthClient;

            db.models.UserAuthorization.create({
                user: user._id,
                client: client._id,

                scope: context.scope || ['emails', 'first_name', 'phone_numbers', 'addresses'],
                entities: context.entities || {
                    emails: [mongoose.Types.ObjectId()],
                    phone_numbers: [mongoose.Types.ObjectId()],
                    addresses: [mongoose.Types.ObjectId()]
                }
            }, function (err, userAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, userAuthorization);
            });
        }]
    }, function (err, results) {
        var userAuthorization = results.createUserAuthorization;

        if (err) {
            return cb(err);
        }

        cb(null, userAuthorization);
    });
};