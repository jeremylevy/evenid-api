var async = require('async');
var mongoose = require('mongoose');

var db = require('../../models');

var createUser = require('./createUser');

var createOauthClient = require('./createOauthClient');
var createOauthRedirectionURI = require('./createOauthRedirectionURI');

var createOauthUserStatus = require('./createOauthUserStatus');
var createOauthEntityID = require('./createOauthEntityID');

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

                cb(null, user);
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

                cb(null, client);
            });
        },

        createOauthRedirectionURI: function (cb) {
            if (context.redirectionURI) {
                return cb(null, context.redirectionURI);
            }

            createOauthRedirectionURI(function (err, redirectionURI) {
                if (err) {
                    return cb(err);
                }

                cb(null, redirectionURI);
            });
        },

        // `false`: has updated fields?
        // `false`: use test account?
        createOauthUserStatus: ['createUser', 'createOauthClient', function (cb, results) {
            var user = results.createUser;
            var client = results.createOauthClient;

            createOauthUserStatus(client.id, user.id, 
                                  'new_user', false,  
                                  function (err, oauthUserStatus) {
                
                if (err) {
                    return cb(err);
                }

                cb(null, oauthUserStatus);
            });
        }],

        createOauthEntitiesID: ['createUser', 'createOauthClient', function (cb, results) {
            var user = results.createUser;
            var client = results.createOauthClient;

            createOauthEntityID({
                user: user.id,
                client: client.id,
                real_id: user.id,
                fake_id: mongoose.Types.ObjectId(),
                entities: ['users']
            }, function (err, oauthEntityID) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthEntityID);
            });
        }],

        createOauthAuthorization: ['createUser', 'createOauthClient', 'createOauthRedirectionURI', function (cb, results) {
            var user = results.createUser;
            var client = results.createOauthClient;
            var redirectionURI = results.createOauthRedirectionURI;

            var emailID = mongoose.Types.ObjectId();
            var billingAddressID = mongoose.Types.ObjectId();
            var phoneNumberID = mongoose.Types.ObjectId();
            
            var expiresAt = new Date();

            expiresAt.setTime(expiresAt.getTime() + (3600 * 1000));

            db.models.OauthAuthorization.create({
                code: {
                    value: mongoose.Types.ObjectId().toString(),
                    expires_at: expiresAt
                },
                
                issued_for: user.id,
                
                issued_to: {
                    client: client.id
                },
                
                type: 'token',
                
                scope: context.scope || ['emails', 'first_name', 'addresses', 'phone_numbers'],
                
                user: {
                    addresses: [{
                        address: billingAddressID,
                        for: 'billing'
                    }]
                }
            }, function (err, oauthAuthorization) {
                if (err) {
                    return cb(err);
                }

                cb(null, oauthAuthorization);
            });
        }]
    }, function (err, results) {
        var user = results.createUser;
        var oauthClient = results.createOauthClient;
        
        var oauthRedirectionURI = results.createOauthRedirectionURI;
        var oauthAuthorization = results.createOauthAuthorization;

        if (err) {
            return cb(err);
        }

        if (context.populateOauthAuthorization) {
            oauthAuthorization.populate('issued_for issued_to.client', 
                                        function (err, oauthAuthorization) {
                
                if (err) {
                    return cb(err);
                }

                cb(null, oauthAuthorization);
            });

            return;
        }

        cb(null, oauthAuthorization);
    });
};