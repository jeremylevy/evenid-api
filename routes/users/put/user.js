var async = require('async');
var validator = require('validator');
var Type = require('type-of-is');
var moment = require('moment');

var config = require('../../../config');

var checkScope = require('../../oauth/middlewares/checkScope');

var AccessDeniedError = require('../../../errors/types/AccessDeniedError');

module.exports = function (app, express) {
    var uriReg = new RegExp('^/users/(' 
                            + config.EVENID_MONGODB.OBJECT_ID_PATTERN
                            + ')$');

    app.put(uriReg, checkScope('app'), function (req, res, next) {
        var profilPhoto = !Type.is(req.body.profil_photo, undefined)
                            ? validator.trim(req.body.profil_photo)
                            : undefined;

        var nickname = !Type.is(req.body.nickname, undefined) 
                            ? validator.trim(req.body.nickname) 
                            : undefined;

        var firstName = !Type.is(req.body.first_name, undefined) 
                            ? validator.trim(req.body.first_name) 
                            : undefined;

        var lastName = !Type.is(req.body.last_name, undefined) 
                            ? validator.trim(req.body.last_name)
                            : undefined;

        var dateOfBirthAsString = [req.body.date_of_birth_month, 
                                   req.body.date_of_birth_day, 
                                   req.body.date_of_birth_year].join('-');
        
        // You may specify a boolean for the last argument 
        // to make Moment use strict parsing
        var dateOfBirth = moment(dateOfBirthAsString, 'M-D-YYYY', true);

        var placeOfBirth = !Type.is(req.body.place_of_birth, undefined) 
                            ? validator.trim(req.body.place_of_birth)
                            : undefined;

        var gender = !Type.is(req.body.gender, undefined) 
                            ? validator.trim(req.body.gender)
                            : undefined;

        var nationality = !Type.is(req.body.nationality, undefined) 
                            ? validator.trim(req.body.nationality)
                            : undefined;

        var timezone = !Type.is(req.body.timezone, undefined) 
                            ? validator.trim(req.body.timezone)
                            : undefined;

        var user = res.locals.user;
        var userID = req.params[0];

        // Check that user is access token user
        if (user.id !== userID) {
            return next(new AccessDeniedError());
        }

        async.auto({
            updateUser: function (cb) {
                if (!Type.is(profilPhoto, undefined)) {
                    user.profil_photo = profilPhoto;
                }

                if (!Type.is(nickname, undefined)) {
                    user.nickname = nickname;
                }

                if (!Type.is(firstName, undefined)) {
                    user.first_name = firstName;
                }

                if (!Type.is(lastName, undefined)) {
                    user.last_name = lastName;
                }

                if (dateOfBirth.isValid()) {
                    user.date_of_birth = dateOfBirth.toDate();

                } else if (req.body.date_of_birth_month === ''
                           && req.body.date_of_birth_day === '' 
                           && req.body.date_of_birth_year === '') {
                    
                    // Update from empty string to `undefined`.
                    // Since Mongoose version 4.0, if you set a 
                    // `non-undefined` field to `undefined`, validators 
                    // will no longer be run. Given that we need to check
                    // if user could remove field asked by client we must 
                    // set field to an empty string instead of `undefined`, run
                    // the validators, then set it to `undefined`.
                    user.date_of_birth = '';

                } else if (req.body.date_of_birth_month
                           || req.body.date_of_birth_day 
                           || req.body.date_of_birth_year) {

                    user.invalidate('date_of_birth', 'Date of birth is invalid.');
                }

                if (!Type.is(placeOfBirth, undefined)) {
                    user.place_of_birth = placeOfBirth;
                }

                if (!Type.is(gender, undefined)) {
                    user.gender = gender;
                }

                if (!Type.is(nationality, undefined)) {
                    user.nationality = nationality;
                }

                if (!Type.is(timezone, undefined)) {
                    user.timezone = timezone;
                }

                user.save(function (err, updatedUser) {
                    if (err) {
                        return cb(err);
                    }

                    cb(null, updatedUser);
                });
            }
        }, function (err, results) {
            var updatedUser = results && results.updateUser;

            if (err) {
                return next(err);
            }

            res.send(updatedUser.toObject());
        });
    });
};