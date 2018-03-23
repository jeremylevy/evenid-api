var net = require('net');
var mongoose = require('mongoose');

var async = require('async');
var validator = require('validator');

var config = require('../../../config');

var db = require('../../../models');

var countEvent = require('../../../models/actions/countEvent');
var insertEvent = require('../../../models/actions/insertEvent');

var checkScope = require('../../oauth/middlewares/checkScope');

var MaxAttemptsError = require('../../../errors/types/MaxAttemptsError');

var IPHeaderMissingError = require('../../../errors/types/IPHeaderMissingError');
var IPHeaderInvalidError = require('../../../errors/types/IPHeaderInvalidError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/is-registered$');

    app.post(uriReg, checkScope('unauthenticated_app'), function (req, res, next) {
        var email = validator.trim(req.body.email);
        var userIPAddress = validator.trim(req.get('x-originating-ip'));

        if (!userIPAddress) {
            return next(new IPHeaderMissingError());
        }

        if (net.isIP(userIPAddress) === 0) {
            return next(new IPHeaderInvalidError());
        }

        async.auto({
            findNbOfRequestForIP: function (cb) {
                countEvent(userIPAddress, null, 'check_for_user_existence', 
                           config.EVENID_EVENTS
                                 .TIMEOUTS
                                 .CHECK_FOR_USER_EXISTENCE, function (err, count) {

                    if (err) {
                        return cb(err);
                    }

                    // Too many attempts, spam?
                    if (count >= config.EVENID_EVENTS
                                       .MAX_ATTEMPTS
                                       .CHECK_FOR_USER_EXISTENCE) {
                        
                        return cb(new MaxAttemptsError());
                    }

                    cb(null, count);
                });
            },

            findEmail: ['findNbOfRequestForIP', function (cb, results) {
                new db.models.Email({
                    address: email,
                    user: mongoose.Types.ObjectId()
                }).validate(function (err) {
                    if (err) {
                        return cb(err);
                    }

                    db.models.Email.findOne({
                        address: email
                    }, function (err, email) {
                        if (err) {
                            return cb(err);
                        }

                        cb(null, email);
                    });
                });
            }],

            insertEvent: ['findEmail', function (cb, results) {
                insertEvent({
                    ip_address: userIPAddress,
                    type: 'check_for_user_existence'
                }, function (err, event) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, event);
                });
            }]
        }, function (err, results) {
            var email = results && results.findEmail;

            if (err) {
                return next(err);
            }

            res.send({
                is_registered: !!email
            });
        });
    });
};