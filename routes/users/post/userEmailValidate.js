var async = require('async');

var config = require('../../../config');

var db = require('../../../models');

var checkScope = require('../../oauth/middlewares/checkScope');

var token = require('../../../libs/token');
var createHash = require('../../../libs/createHash');
var sendEmail = require('../../../libs/sendEmail');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');
var NotFoundError = require('../../../errors/types/NotFoundError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/emails/('
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')/validate$');

    // Used by app and clients
    app.post(uriReg, checkScope(['app', 'emails']), function (req, res, next) {
        // See `findRealIDForClientSpecificID` middleware
        var userID = res.locals.realUserID || req.params[0];
        var emailID = res.locals.realEntityID || req.params[1];

        var currentLocale = req.i18n.getLocale();

        var user = res.locals.user;
        var authorization = res.locals.accessToken.authorization;

        var clientID = null;

        // Check that user is access token user
        if (user.id !== userID
            // Check that user own email
            || !user.ownEmail(emailID)) {
            
            return next(new AccessDeniedError());
        }

        if (!authorization.hasAppScope()) {
            clientID = authorization.issued_to.client;
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
                db.models.Email.findById(emailID, function (err, email) {
                    if (err) {
                        return cb(err);
                    }

                    if (!email) {
                        return cb(new NotFoundError());
                    }

                    if (email.is_verified) {
                        return cb(new AccessDeniedError('Your email address has already been validated.'));
                    }

                    cb(null, email);
                });
            },

            // Count validation requests between now and 
            // now minus `EVENID_USER_VALIDATE_EMAIL_REQUESTS.TIMEOUT`
            countValidationRequests: ['findEmail', function (cb, results) {
                var email = results.findEmail;

                var timeoutDate = new Date();

                timeoutDate.setTime(timeoutDate.getTime() 
                                    - (config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                                             .TIMEOUT * 1000));

                db.models.UserValidateEmailRequest.count({
                    user: userID,
                    email: email.id,
                    created_at: {
                        $gte: timeoutDate
                    }
                }, function (err, count) {
                    if (err) {
                        return cb(err);
                    }

                    if (count >= config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                                       .MAX_ATTEMPTS) {
                        
                        return cb(new AccessDeniedError('You have reached the maximum number '
                                                      + 'of email validate requests allowed per day.'));
                    }

                    cb(null, count);
                });
            }],

            insertValidateEmailRequest: ['generateCode',
                                         'countValidationRequests',
                                         function (cb, results) {
                
                var email = results.findEmail;
                var code = results.generateCode;

                var expiresAt = new Date();

                expiresAt.setTime(expiresAt.getTime() 
                                  + (config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                                           .CODE
                                           .VALIDITY_PERIOD * 1000));

                db.models.UserValidateEmailRequest.create({
                    user: userID,
                    email: email.id,
                    code: createHash(config.EVENID_USER_VALIDATE_EMAIL_REQUESTS
                                           .CODE
                                           .HASHING_ALGORITHM, code),
                    expires_at: expiresAt
                }, function (err, request) {
                    if (err) {
                        return cb(err);
                    }

                    // Code is hashed in DB
                    // Give access to raw `code` 
                    // in order to embed it
                    // in email
                    request.code = code;

                    cb(null, request);
                });
            }],

            findClient: ['insertValidateEmailRequest', function (cb, results) {
                if (!clientID) {
                    return cb(null);
                }

                db.models.OauthClient.findById(clientID, function (err, client) {
                    if (err) {
                        return cb(err);
                    }

                    if (!client) {
                        return cb(new NotFoundError('Client was not found.'));
                    }

                    cb(null, client);
                });
            }],

            sendEmail: ['findClient', function (cb, results) {
                var email = results.findEmail;
                var client = results.findClient;
                var validateEmailRequest = results.insertValidateEmailRequest;

                var clientName = client ? client.name : config.EVENID_APP.NAME;
                var clientLogo = client ? client.logo : config.EVENID_APP.LOGO;

                var code = validateEmailRequest.code;
                var link = config.EVENID_APP.ENDPOINT 
                            + '/users/' + userID 
                            + '/emails/' + emailID 
                            + '/validate/';

                if (config.ENV === 'test') {
                    link += 'TEST_VALID_CODE';
                } else {
                    link += code;
                }

                sendEmail([email.address], 
                          clientName,
                          clientLogo,
                          req.i18n.__('Validate my email address'), 
                          currentLocale, 
                          'validate_email', 
                          [email.address, link, link, clientName], function (err, resp) {
                    
                    if (err) {
                        return cb(err);
                    }

                    cb(null, resp);
                });
            }]
        }, function (err, results) {
            var validateEmailRequest = results 
                                    && results.insertValidateEmailRequest;
            var resp = validateEmailRequest 
                    && validateEmailRequest.toObject();

            if (err) {
                return next(err);
            }

            // /!\ Make sure we don't send code 
            // in non-test environments !!!!!!
            res.send(!authorization.hasAppScope() 
                     || config.ENV !== 'test'
                     ? {status: 'ok'} 
                     : resp);
        });
    });
};