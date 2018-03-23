var querystring = require('querystring');

var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var token = require('../../../libs/token');
var createHash = require('../../../libs/createHash');
var sendEmail = require('../../../libs/sendEmail');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

var checkScope = require('../../oauth/middlewares/checkScope');

var checkOauthAuthQS = require('../../oauth/middlewares/authorize/checkQueryString');
var checkOauthAuthClientAndRedirectURI = require('../../oauth/middlewares/authorize/checkClientAndRedirectURI');

var checkContext = {
    name: 'userRecoverPassword'
};

module.exports = function (app, express) {
    
    app.post('/users/recover-password',
             checkScope('unauthenticated_app'),
             // In case it was used 
             // during Oauth authorize make sure
             // passed query was valid before added 
             // it to email
             checkOauthAuthQS.bind(checkContext), 
             checkOauthAuthClientAndRedirectURI.bind(checkContext),
             function (req, res, next) {
        
        var email = validator.trim(req.body.email);

        // Used during Oauth authorize
        var clientID = validator.trim(req.body.client);
        // It's an object, so don't use `validator.trim()` here
        var query = req.body.query;

        var currentLocale = req.i18n.getLocale();

        var accountDoesntExistErr = new AccessDeniedError('Your email address does not belong to any account.');

        if (!validator.isEmail(email)) {
            return next(new AccessDeniedError('Your email address is invalid.'));
        }

        async.auto({
            generateCode: function (cb) {
                token(function (err, token) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, token);
                });
            },

            findEmail: function (cb) {
                db.models.Email.findOne({
                    address: email
                },  function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    if (!email) {
                        return cb(accountDoesntExistErr);
                    }

                    cb(null, email);
                });
            },

            findUser: ['findEmail', function (cb, results) {
                var email = results.findEmail;

                db.models.User.findOne({
                    emails: email.id
                }, function (err, user) {
                    if (err) {
                        return cb(err);
                    }

                    if (!user) {
                        return cb(accountDoesntExistErr);
                    }

                    cb(null, user);
                });
            }],

            countResetRequests: ['findUser', function (cb, results) {
                var user = results.findUser;
                var timeoutDate = new Date();

                timeoutDate.setTime(timeoutDate.getTime() 
                                    - (config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                             .TIMEOUT * 1000));

                db.models.UserResetPasswordRequest.count({
                    user: user.id,
                    created_at: {
                        $gte: timeoutDate
                    }
                }, function (err, count) {
                    if (err) {
                        return cb(err);
                    }

                    if (count >= config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                       .MAX_ATTEMPTS) {
                        
                        return cb(new AccessDeniedError('You have reached the maximum number '
                                                      + 'of password reset requests allowed per day.'));
                    }

                    cb(null, count);
                });
            }],

            insertRequest: ['generateCode', 'countResetRequests', function (cb, results) {
                var user = results.findUser;
                var email = results.findEmail;
                var code = results.generateCode;
                var expiresAt = new Date();

                expiresAt.setTime(expiresAt.getTime() 
                                  + (config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                           .CODE
                                           .VALIDITY_PERIOD * 1000));

                db.models.UserResetPasswordRequest.create({
                    user: user.id,
                    email: email.id,
                    code: createHash(config.EVENID_USER_RESET_PASSWORD_REQUESTS
                                           .CODE
                                           .HASHING_ALGORITHM, code),
                    expires_at: expiresAt
                }, function (err, request) {
                    if (err) {
                        return cb(err);
                    }

                    // Give access to raw `code` 
                    // in order to embed it in email
                    request._code = code;

                    cb(null, request);
                });
            }],

            findClient: ['insertRequest', function (cb, results) {
                if (!clientID) {
                    return cb(null);
                }

                // Given by `checkClientAndRedirectURI`
                // middleware
                cb(null, res.locals.client);
            }],

            sendEmail: ['findClient', function (cb, results) {
                var email = results.findEmail;
                var user = results.findUser;
                var client = results.findClient;

                var toString = function (s) {
                    return s.toString();
                };
                var authorizedClients = user.authorized_clients.map(toString);

                var clientName = config.EVENID_APP.NAME;
                var clientLogo = config.EVENID_APP.LOGO;

                // Code was hashed in db, get raw value
                var code = results.insertRequest._code;
                var link = config.EVENID_APP.ENDPOINT + '/recover-password/';

                if (config.ENV === 'test') {
                    link += 'TEST_VALID_CODE';
                } else {
                    link += code;
                }

                // Used during Oauth authorize
                if (client) {
                    // if (authorizedClients.indexOf(client.id) !== -1) {
                        clientName = client.name;
                        clientLogo = client.logo;
                    // }

                    // Add code to passed querystring
                    query.code = code;

                    if (config.ENV === 'test') {
                        query.code = 'TEST_VALID_CODE';
                    }

                    link = config.EVENID_APP.ENDPOINT 
                            + '/oauth/authorize?' 
                            + querystring.stringify(query);
                }

                sendEmail([email.address], 
                          clientName,
                          clientLogo,
                          req.i18n.__('Reset my password'), 
                          currentLocale, 
                          'recover_password', 
                          [clientName, link, link, clientName],
                          function (err, resp) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var request = results && results.insertRequest;
            var insertedCode = request && request._code;
            // `toObject()` removes `_code` property
            var resp = request && request.toObject();

            if (err) {
                return next(err);
            }

            // Code is hashed in db.
            // Send real value
            resp.code = insertedCode;

            // /!\ Make sure we don't send code 
            // in non-test environments !!!!!!
            res.send(config.ENV === 'test' ? resp : {status: 'ok'});
        });
    });
};