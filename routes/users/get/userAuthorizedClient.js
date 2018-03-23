var async = require('async');
var moment = require('moment');

var config = require('../../../config');

var db = require('../../../models');

var localesData = require('../../../locales/data');

var findUserAuthorizationForClient = require('../../../models/actions/findUserAuthorizationForClient');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');
var getUser = require('../../users/middlewares/getUser');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/authorized-clients/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN 
                            + ')$');

    app.get(uriReg, checkScope('app'), function (req, res, next) {
        var currentLocale = req.i18n.getLocale();

        var user = res.locals.user;

        var userID = req.params[0];
        var clientID = req.params[1];

        // Check that user is access token user
        if (userID !== user.id
            // Check that user has authorized client
            || !user.hasAuthorizedClient(clientID)) {
            
            return next(new AccessDeniedError());
        }

        async.auto({
            findClient: function (cb) {
                var select = 'name logo description '
                           + 'website facebook_username '
                           + 'twitter_username instagram_username';

                var query = db.models.OauthClient.findById(clientID,
                                                           select,
                                                           function (err, client) {
                    
                    if (err) {
                        return cb(err);
                    }

                    if (!client) {
                        return cb(new NotFoundError());
                    }

                    cb(null, client);
                });
            },

            findUserAuthorizationForClient: ['findClient', function (cb, results) {
                var client = results.findClient;

                findUserAuthorizationForClient(user._id,
                                               client._id,
                                               function (err, userAuthorization) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, userAuthorization);
                });
            }],

            findUserAsViewedByClient: ['findUserAuthorizationForClient', function (cb, results) {
                var client = results.findClient;
                var userAuthorizationForClient = results.findUserAuthorizationForClient;

                getUser.call({
                    name: 'showAuthorizedClientToUser',
                    userAuthorizationForClient: userAuthorizationForClient
                }, req, res, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, user);
                });
            }]
        }, function (err, results) {
            var client = results && results.findClient;
            var clientAsObject = null;

            var userAuthorizationForClient = results && results.findUserAuthorizationForClient;
            var authorizedUser = results && results.findUserAsViewedByClient;
            var rawAuthorizedUser = {};

            var dateOfBirth = null;

            var territories = localesData[currentLocale].territories;
            var nationalities = localesData[currentLocale].nationalities;
            var timezones = localesData[currentLocale].timezones;

            var clientHasAskedForFullName = false;

            if (err) {
                return next(err);
            }

            clientAsObject = client.toObject();
            clientHasAskedForFullName = userAuthorizationForClient.scope.indexOf('first_name') !== -1 
                                        && userAuthorizationForClient.scope.indexOf('last_name') !== -1;

            userAuthorizationForClient.scope.forEach(function (scopeValue) {
                // Format date of birth
                if ('date_of_birth' === scopeValue) {
                    dateOfBirth = moment.unix(authorizedUser.date_of_birth);
                    
                    dateOfBirth.locale(currentLocale);
                    
                    rawAuthorizedUser[scopeValue] = dateOfBirth.format('LL');
                    
                    return;
                }

                // Country locale to full country (`US` -> `United-States`)
                if ('place_of_birth' === scopeValue) {
                    rawAuthorizedUser[scopeValue] = territories[authorizedUser[scopeValue]];
                    
                    return;
                }

                // Country locale to nationality (`US` -> `American`)
                if ('nationality' === scopeValue) {
                    rawAuthorizedUser[scopeValue] = nationalities[authorizedUser[scopeValue]];

                    return;
                }

                if ('timezone' === scopeValue) {
                    Object.keys(timezones).forEach(function (continent) {
                        Object.keys(timezones[continent]).forEach(function (timezoneCode) {
                            if (authorizedUser[scopeValue] !== timezoneCode) {
                                return;
                            }

                            rawAuthorizedUser[scopeValue] = timezones[continent][timezoneCode];
                        });
                    });

                    return;
                }

                if (['first_name', 'last_name'].indexOf(scopeValue) !== -1
                    && clientHasAskedForFullName) {

                    // Keep the same order by not assing it outside the loop
                    if (!rawAuthorizedUser.full_name) {
                        rawAuthorizedUser.full_name = authorizedUser.first_name + ' ' + authorizedUser.last_name;
                    }

                    return;
                }

                rawAuthorizedUser[scopeValue] = authorizedUser[scopeValue];
            });

            res.send({
                client: clientAsObject,
                authorizedUser: rawAuthorizedUser
            });
        });
    });
};