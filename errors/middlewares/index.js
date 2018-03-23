var Type = require('type-of-is');
var mongoose = require('mongoose');
var util = require('util');
var changecase = require('change-case');

var config = require('../../config');

var isValidationError = require('../../models/validators/isValidationError');
var isUniqueIndexError = require('../../models/validators/isUniqueIndexError');
var isCastError = require('../../models/validators/isCastError');

var AccessDeniedError = require('../types/AccessDeniedError');
var NotFoundError = require('../types/NotFoundError');
var MaxAttemptsError = require('../types/MaxAttemptsError');
var InvalidRequestError = require('../types/InvalidRequestError');
var InvalidTokenError = require('../types/InvalidTokenError');
var ExpiredTokenError = require('../types/ExpiredTokenError');

module.exports = function (err, req, res, next) {
    var isMongooseError = err instanceof mongoose.Error;
    var isAccessDeniedError = err instanceof AccessDeniedError;
    var isNotFoundError = err instanceof NotFoundError;
    var isMaxAttemptsError = err instanceof MaxAttemptsError;
    var isInvalidRequestError = err instanceof InvalidRequestError;
    var isInvalidTokenError = err instanceof InvalidTokenError;
    var isExpiredTokenError = err instanceof ExpiredTokenError;
    var resp = {
        statusCode: 500,
        error:{
            type: 'server_error',
            messages: {
                main: 'The server encountered an unexpected '
                    + 'condition that prevented it from fulfilling '
                    + 'the request.'
            }
        }
    };
    var mongooseValidationErrorMessages = {
        required: '%s must be set.',
        min: '%s is below minimum.',
        max: '%s is above maximum.',
        enum: '%s is not an allowed value.',
        unique: 'This %s is already used.',
        cast: '%s is invalid.'
    };
    
    if (isValidationError(err)
        || isUniqueIndexError(err)
        || isCastError(err)
        || isInvalidRequestError) {

        resp.statusCode = 400;
        resp.error.type = 'invalid_request';
        resp.error.messages.main = 'The request is missing a required parameter, ' 
                                 + 'includes an invalid parameter value, '
                                 + 'includes a parameter more than once, or is otherwise malformed.';

        // Mock the errors object to use the same logic
        // than during validation error
        if (isUniqueIndexError(err)) {
            // When Mongoose raise an `Unique Index Error`
            // returned error doesn't contain `errors` hash
            if (!err.errors) {
                err.errors = {};
            }
            
            err.errors.uniqueError = err;
        }

        if (isCastError(err)) {
            // Type is the type of the field (eg. date)
            err.kind = 'cast';
            
            if (!err.errors) {
                err.errors = {};
            }
            
            err.errors.castError = err;
        }

        if (isInvalidRequestError) {
            err.errors = err.mongooseValidationErrors;
        }
        
        // Loop over the errors object of the Validation Error
        Object.keys(err.errors).forEach(function (field) {
            var eObj = err.errors[field];
            var field = null;

            if (isUniqueIndexError(eObj)) {
                eObj = {
                    // To get path for unique indexes on multiple fields
                    message: eObj.message,
                    kind: 'unique',
                    // Index name example: `index: field_(-1|1)` 
                    // (Last number depends on index ordering)
                    // See http://docs.mongodb.org/manual/core/index-creation/#index-names
                    // Get `field`
                    path: eObj.message.match(/index:\s([^\s]+)_(-1|1)/)[1],
                };

                // For unique indexes on multiple fields
                Object.keys(config.EVENID_MONGODB.UNIQUE_INDEXES_PATH).forEach(function (path) {
                    var reg = config.EVENID_MONGODB.UNIQUE_INDEXES_PATH[path];

                    if (eObj.message.match(reg)) {
                        eObj.path = path;
                    }
                });

                // We don't needs it anymore
                delete eObj.message;
            }

            eObj.path = eObj.path.replace(/^address$/, 'email');

            if (!eObj.kind
                && eObj.properties
                && eObj.properties.kind) {

                eObj.kind = eObj.properties.kind;
            }

            // If we don't have a message for `type`, 
            // push the built-in message property
            if (!mongooseValidationErrorMessages.hasOwnProperty(eObj.kind)) {
                resp.error.messages[eObj.path] = req.i18n.__(eObj.message);
            } else { // Otherwise, the message type

                // Prefix is used during oauth Authorization
                // when multiple entity with the same type (like addresses)
                // needs to be inserted in the same time
                if (!eObj.prefix) {
                    eObj.prefix = '';
                }

                field = eObj.path
                            // Remove prefix if any
                            .replace(new RegExp('^' + eObj.prefix), '')
                            // `phone_number` -> `phone number`
                            .replace(/_/g, ' ');

                // Unique error doesn't start with field name
                // -> `This nickname is already used`
                if (eObj.kind !== 'unique') {
                    field = changecase.upperCaseFirst(field);
                }

                resp.error.messages[eObj.path] = req.i18n.__(util.format(mongooseValidationErrorMessages[eObj.kind], 
                                                                         field));
            } 
        });
    }

    // Invalid parameters may be set directly in messages
    // object not build from mongoose validation errors
    if (isInvalidRequestError
        && Object.keys(err.messages).length > 0) {

        for (var message in err.messages) {
            resp.error.messages[message] = req.i18n.__(err.messages[message]);
        }
    }

    if (isInvalidTokenError) {
        resp.statusCode = 400;
        resp.error.type = 'invalid_token';
        resp.error.messages.main = err.message;
    }

    if (isExpiredTokenError) {
        resp.statusCode = 400;
        resp.error.type = 'expired_token';
        resp.error.messages.main = err.message;
    }

    if (isAccessDeniedError) {
        resp.statusCode = 403;
        resp.error.type = 'access_denied';
        resp.error.messages.main = err.message;
    }

    if (isNotFoundError) {
        resp.statusCode = 404;
        resp.error.type = 'not_found';
        resp.error.messages.main = err.message;
    }

    if (isMaxAttemptsError) {
        resp.statusCode = 403;
        resp.error.type = err.captchaError 
            ? 'max_attempts_captcha_error' 
            : 'max_attempts_reached';
        resp.error.messages.main = err.message;
    }

    // Internationalize main error message
    resp.error.messages.main = req.i18n.__(resp.error.messages.main);

    if (['stage', 'development'].indexOf(config.ENV) !== -1 
        || (config.ENV === 'test' 
            && resp.error.type === 'server_error')) {

        console.error('ERROR IN API -> ', err, err.stack);
    }
    
    res.status(resp.statusCode).send({
        error: {
            type: resp.error.type,
            messages: resp.error.messages
        }
    });
};